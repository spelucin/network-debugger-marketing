import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (...args: any[]) => any;

const listeners: Record<string, Listener> = {};
const pendingStorageGets: Array<(value: Record<string, unknown>) => void> = [];
const platformInfo = vi.fn(() => Promise.resolve({ os: "mac" }));
const alarmsCreate = vi.fn();
const alarmListeners: Listener[] = [];
const installedListeners: Listener[] = [];
const setBadgeText = vi.fn(async () => undefined);
const setBadgeBackgroundColor = vi.fn(async () => undefined);

(globalThis as any).chrome = {
  storage: {
    session: {
      get: () =>
        new Promise<Record<string, unknown>>((resolve) => {
          pendingStorageGets.push(resolve);
        }),
      set: async () => undefined,
      remove: async () => undefined,
    },
    onChanged: { addListener: () => undefined, removeListener: () => undefined },
  },
  runtime: {
    getPlatformInfo: platformInfo,
    getManifest: () => ({ version: "1.5.0", permissions: ["webRequest"] }),
    onMessage: { addListener: (fn: Listener) => (listeners.message = fn) },
    onConnect: { addListener: () => undefined },
    onInstalled: { addListener: (fn: Listener) => installedListeners.push(fn) },
    onStartup: { addListener: () => undefined },
  },
  alarms: {
    create: alarmsCreate,
    onAlarm: { addListener: (fn: Listener) => alarmListeners.push(fn) },
  },
  webRequest: {
    onBeforeRequest: {
      addListener: (fn: Listener) => (listeners.beforeRequest = fn),
    },
    onCompleted: {
      addListener: (fn: Listener) => (listeners.completedRequest = fn),
    },
  },
  tabs: {
    onActivated: { addListener: () => undefined },
    onUpdated: { addListener: (fn: Listener) => (listeners.tabUpdated = fn) },
    query: async () => [{ id: 7, active: true }],
  },
  windows: {
    getLastFocused: async () => ({ id: 1 }),
    onFocusChanged: { addListener: () => undefined },
    WINDOW_ID_NONE: -1,
  },
  action: {
    setBadgeText,
    setBadgeBackgroundColor,
  },
  sidePanel: { setPanelBehavior: async () => undefined },
};

function flushStorage() {
  while (pendingStorageGets.length > 0) {
    const resolve = pendingStorageGets.shift();
    resolve?.({});
  }
}

interface SnapshotResponse {
  ok: boolean;
  snapshot?: { requests: Array<Record<string, unknown>> };
}

async function getSnapshot(): Promise<SnapshotResponse> {
  return new Promise<SnapshotResponse>((resolve) => {
    listeners["message"]!({ type: "get-snapshot" }, {}, resolve);
  });
}

describe("background cold-start buffering", () => {
  it("keeps the tracking burst that arrives alongside a navigation while hydrating", async () => {
    await import("./index");

    // Both events land before hydration completes, as on a cold worker wake:
    // the navigation "loading" event first, then the page's tracking burst.
    listeners["tabUpdated"]!(7, { status: "loading" });
    listeners["beforeRequest"]!({
      requestId: "1",
      tabId: 7,
      method: "GET",
      type: "xmlhttprequest",
      url: "https://www.google-analytics.com/g/collect?v=2&tid=G-ABC123&en=page_view&cid=1.2&sid=1",
    });

    flushStorage();

    const snapshot = await getSnapshot();
    expect(snapshot.ok).toBe(true);
    expect(snapshot.snapshot?.requests).toHaveLength(1);
    expect(snapshot.snapshot?.requests[0]?.eventName).toBe("page_view");
  });
});

describe("background keepalive", () => {
  beforeEach(() => {
    vi.resetModules();
    platformInfo.mockClear();
    alarmsCreate.mockClear();
    alarmListeners.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setCapture(enabled: boolean): Promise<unknown> {
    return new Promise((resolve) => {
      listeners["message"]!({ type: "set-capture-enabled", enabled }, {}, resolve);
    });
  }

  it("registers the backup alarm on boot", async () => {
    await import("./index");
    expect(alarmsCreate).toHaveBeenCalledWith("nd-keepalive", {
      periodInMinutes: 0.5,
    });
  });

  it("pings a chrome API every 20s to hold the worker open", async () => {
    vi.useFakeTimers();
    await import("./index");
    expect(platformInfo).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(platformInfo).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(platformInfo).toHaveBeenCalledTimes(4);
  });

  it("stops pinging when capture is disabled and resumes when re-enabled", async () => {
    vi.useFakeTimers();
    await import("./index");

    await setCapture(false);
    const callsAtDisable = platformInfo.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(platformInfo.mock.calls.length).toBe(callsAtDisable);

    await setCapture(true);
    expect(platformInfo.mock.calls.length).toBe(callsAtDisable + 1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(platformInfo.mock.calls.length).toBe(callsAtDisable + 2);
  });

  it("ignores the backup alarm while capture is disabled", async () => {
    vi.useFakeTimers();
    await import("./index");
    await setCapture(false);

    const callsAtDisable = platformInfo.mock.calls.length;
    for (const fire of alarmListeners) fire({ name: "nd-keepalive" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(platformInfo.mock.calls.length).toBe(callsAtDisable);
  });
});

describe("background self-test", () => {
  const SELF_TEST_URL =
    "https://www.googletagmanager.com/gtc.js?id=ND-SELFTEST";

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    setBadgeText.mockClear();
    setBadgeBackgroundColor.mockClear();
    installedListeners.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("raises a badge warning when webRequest delivery is broken", async () => {
    vi.useFakeTimers();
    await import("./index");
    for (const fire of installedListeners) fire();

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetch).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(setBadgeText).toHaveBeenCalledWith({ text: "!" });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: "#dc2626" });
  });

  it("stays quiet when the probe request is observed", async () => {
    vi.useFakeTimers();
    await import("./index");
    for (const fire of installedListeners) fire();
    listeners["beforeRequest"]!({ url: SELF_TEST_URL });

    await vi.advanceTimersByTimeAsync(7_000);
    expect(setBadgeText).not.toHaveBeenCalledWith({ text: "!" });
  });

  it("never stores the self-test beacon as a captured request", async () => {
    vi.useFakeTimers();
    await import("./index");
    listeners["beforeRequest"]!({ url: SELF_TEST_URL });
    flushStorage();

    const snapshot = await getSnapshot();
    expect(snapshot.snapshot?.requests).toHaveLength(0);
  });
});

describe("main-world ingestion", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function sendMainWorld(
    payload: Record<string, unknown>,
    sender: unknown = { tab: { id: 7 } }
  ): Promise<unknown> {
    return new Promise((resolve) => {
      listeners["message"]!(
        { type: "mainworld-request", payload },
        sender,
        resolve
      );
    });
  }

  const GA_URL =
    "https://www.google-analytics.com/g/collect?v=2&tid=G-ABC123&en=page_view&cid=1.2&sid=1";

  it("captures page-hooked tracking calls and decodes them", async () => {
    await import("./index");
    flushStorage();

    await sendMainWorld({ kind: "fetch", method: "GET", url: GA_URL });

    const snapshot = await getSnapshot();
    expect(snapshot.snapshot?.requests).toHaveLength(1);
    expect(snapshot.snapshot?.requests[0]?.eventName).toBe("page_view");
  });

  it("parses request bodies reported by the page hooks", async () => {
    await import("./index");
    flushStorage();

    await sendMainWorld({
      kind: "beacon",
      method: "POST",
      url: GA_URL,
      bodyText: "v=2&tid=G-ABC123&en=page_view&cid=1.2&sid=1",
    });

    const snapshot = await getSnapshot();
    expect(snapshot.snapshot?.requests).toHaveLength(1);
    expect(snapshot.snapshot?.requests[0]?.method).toBe("POST");
  });

  it("drops the webRequest duplicate of a page-hooked call", async () => {
    await import("./index");
    flushStorage();

    await sendMainWorld({ kind: "fetch", method: "GET", url: GA_URL });
    listeners["beforeRequest"]!({
      requestId: "9",
      tabId: 7,
      method: "GET",
      type: "xmlhttprequest",
      url: GA_URL,
    });

    const snapshot = await getSnapshot();
    expect(snapshot.snapshot?.requests).toHaveLength(1);
  });

  it("drops the page-hooked duplicate of a webRequest call", async () => {
    await import("./index");
    flushStorage();

    listeners["beforeRequest"]!({
      requestId: "10",
      tabId: 7,
      method: "GET",
      type: "xmlhttprequest",
      url: GA_URL,
    });
    await sendMainWorld({ kind: "fetch", method: "GET", url: GA_URL });

    const snapshot = await getSnapshot();
    expect(snapshot.snapshot?.requests).toHaveLength(1);
  });
});

describe("observation plane (capture stats)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function sendCompleted(details: Record<string, unknown>): void {
    listeners["completedRequest"]!(details);
  }

  async function getStats(): Promise<{
    ok: boolean;
    stats?: {
      platforms: Array<{ platform: string; hits: number; scriptIds: string[] }>;
      perf: { observed: number; matched: number; avgMs: number };
    };
  }> {
    return new Promise((resolve) => {
      listeners["message"]!(
        { type: "get-capture-stats", tabId: 7 },
        {},
        resolve
      );
    });
  }

  it("builds per-tab platform presence and throughput from completed requests", async () => {
    await import("./index");
    flushStorage();
    await getSnapshot();

    sendCompleted({
      url: "https://www.google-analytics.com/g/collect?v=2",
      tabId: 7,
      type: "xmlhttprequest",
    });
    // SDK loader only — Meta shows up before any /tr beacon fires
    sendCompleted({
      url: "https://connect.facebook.net/en_US/fbevents.js",
      tabId: 7,
      type: "script",
    });
    // Unmatched traffic still counts toward observed
    sendCompleted({
      url: "https://cdn.example.com/app.bundle.js",
      tabId: 7,
      type: "script",
    });
    // Another tab must not leak into tab 7's snapshot
    sendCompleted({
      url: "https://www.clarity.ms/tag/proj42",
      tabId: 99,
      type: "script",
    });
    // Ad creatives are not tagging signals — image from an ad host is skipped
    sendCompleted({
      url: "https://securepubads.g.doubleclick.net/pcs/view?ad_url=x.png",
      tabId: 7,
      type: "image",
    });

    const res = await getStats();
    expect(res.ok).toBe(true);
    expect(res.stats?.perf.observed).toBe(3);
    expect(res.stats?.perf.matched).toBe(1);
    const ga = res.stats?.platforms.find((p) => p.platform === "ga4");
    expect(ga?.hits).toBe(1);
    const meta = res.stats?.platforms.find((p) => p.platform === "meta");
    expect(meta).toBeDefined();
    expect(res.stats?.perf.avgMs).toBeTypeOf("number");
  });

  it("records script ids lifted from loader urls", async () => {
    await import("./index");
    flushStorage();
    await getSnapshot(); // ensure init (and listener wiring) has settled

    sendCompleted({
      url: "https://www.googletagmanager.com/gtag/js?id=AW-1100011",
      tabId: 7,
      type: "script",
    });

    const res = await getStats();
    const ads = res.stats?.platforms.find((p) => p.platform === "google_ads");
    expect(ads?.scriptIds).toContain("AW-1100011");
  });

  it("accepts page-side resource feeds where webRequest is blind", async () => {
    await import("./index");
    flushStorage();
    await getSnapshot(); // ensure init (and listener wiring) has settled

    const sendResources = (
      urls: string[],
      sender: Record<string, unknown>
    ): void => {
      listeners["message"]!(
        { type: "mainworld-resources", urls },
        sender,
        () => undefined
      );
    };

    sendResources(
      [
        "https://www.google-analytics.com/g/collect?v=2&tid=G-FEED1",
        "https://connect.facebook.net/en_US/fbevents.js",
        "https://www.clarity.ms/tag/feedproj",
        "https://cdn.example.com/app.bundle.js", // unrelated — filtered upstream
      ].slice(0, 3),
      { tab: { id: 7 } }
    );

    const res = await getStats();
    expect(res.stats?.perf.observed).toBe(3);
    expect(res.stats?.perf.matched).toBe(2); // GA + Clarity; fbevents is loader-only
    const ga = res.stats?.platforms.find((p) => p.platform === "ga4");
    expect(ga?.hits).toBe(1);
    const meta = res.stats?.platforms.find((p) => p.platform === "meta");
    expect(meta).toBeDefined();

    // Duplicate sightings (SPA re-runs, relay retries) must not double-count.
    sendResources(
      ["https://www.google-analytics.com/g/collect?v=2&tid=G-FEED1"],
      { tab: { id: 7 } }
    );
    const again = await getStats();
    expect(again.stats?.perf.observed).toBe(3);

    // Batches without a tab context are ignored entirely.
    sendResources(["https://www.google-analytics.com/g/collect?v=3"], {});
    const noTab = await getStats();
    expect(noTab.stats?.perf.observed).toBe(3);
  });
});
