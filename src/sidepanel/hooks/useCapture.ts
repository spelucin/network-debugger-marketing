import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CaptureSettings,
  CaptureSnapshot,
  CaptureStats,
  MarketingRequest,
} from "../../core/types";
import { DEFAULT_SETTINGS, EMPTY_CAPTURE_STATS } from "../../core/types";
import { STORAGE_KEYS } from "../../shared/messages";

function send<M>(message: M): Promise<unknown> {
  return chrome.runtime.sendMessage(message).catch(() => undefined);
}

/**
 * Connects the side panel to the background capture service. Reads a snapshot
 * on mount and stays in sync through chrome.storage.onChanged.
 */
export function useCapture() {
  const [requests, setRequests] = useState<MarketingRequest[]>([]);
  const [settings, setSettings] = useState<CaptureSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<CaptureStats>(EMPTY_CAPTURE_STATS);
  const [activeTabId, setActiveTabId] = useState<number | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);

  // Detection chips / throughput counters live only in worker memory, so they
  // ride their own lightweight request instead of the persisted snapshot.
  const refreshStats = useCallback(() => {
    void send<{ type: "get-capture-stats" }>({ type: "get-capture-stats" }).then(
      (res) => {
        if (!alive.current) return;
        const r = res as { ok: true; stats: CaptureStats } | undefined;
        if (r?.ok) setStats(r.stats);
      }
    );
  }, []);

  useEffect(() => {
    alive.current = true;
    void send<{ type: "get-snapshot" }>({ type: "get-snapshot" })
      .then((res) => {
        if (!alive.current) return;
        const snapshot = res as
          | { ok: true; snapshot: CaptureSnapshot; activeTabId?: number }
          | undefined;
        if (snapshot?.ok) {
          setRequests(snapshot.snapshot.requests);
          setSettings(snapshot.snapshot.settings);
          setActiveTabId(snapshot.activeTabId ?? snapshot.snapshot.activeTabId);
        }
      })
      .finally(() => {
        refreshStats();
        if (alive.current) setReady(true);
      });

    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local" && area !== "session") return;
      const req = changes[STORAGE_KEYS.requests];
      if (req && Array.isArray(req.newValue)) {
        setRequests(req.newValue as MarketingRequest[]);
        refreshStats();
      }
      const st = changes[STORAGE_KEYS.settings];
      if (st) {
        setSettings({ ...DEFAULT_SETTINGS, ...(st.newValue as Partial<CaptureSettings>) });
        refreshStats();
      }
      const tab = changes[STORAGE_KEYS.activeTab];
      if (tab) {
        setActiveTabId(typeof tab.newValue === "number" ? tab.newValue : undefined);
        refreshStats();
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      alive.current = false;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, [refreshStats]);

  const setCapturing = useCallback((enabled: boolean) => {
    void send<{ type: "set-capture-enabled"; enabled: boolean }>({
      type: "set-capture-enabled",
      enabled,
    });
  }, []);

  const setRecordScope = useCallback((thisTab: boolean, allTabs: boolean) => {
    void send<{ type: "set-record-scope"; thisTab: boolean; allTabs: boolean }>({
      type: "set-record-scope",
      thisTab,
      allTabs,
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<CaptureSettings>) => {
    void send<{ type: "set-settings"; settings: Partial<CaptureSettings> }>({
      type: "set-settings",
      settings: patch,
    });
  }, []);

  const clear = useCallback(() => {
    void send<{ type: "clear-capture" }>({ type: "clear-capture" });
  }, []);

  const clearTab = useCallback((tabId: number) => {
    void send<{ type: "clear-tab"; tabId: number }>({ type: "clear-tab", tabId });
  }, []);

  return {
    requests,
    settings,
    stats,
    captureEnabled: settings.captureEnabled,
    recordThisTab: settings.recordThisTab,
    recordAllTabs: settings.recordAllTabs,
    activeTabId,
    ready,
    setCapturing,
    setRecordScope,
    updateSettings,
    clear,
    clearTab,
  };
}