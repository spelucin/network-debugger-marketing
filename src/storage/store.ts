import type {
  CaptureSettings,
  CaptureSnapshot,
  MarketingRequest,
} from "../core/types";
import { STORAGE_KEYS } from "../shared/messages";
import { DEFAULT_SETTINGS } from "../core/types";

/**
 * Persistence layer. The background worker owns writes; the side panel and
 * options page subscribe to chrome.storage.onChanged for live updates.
 *
 * Everything lives in `storage.session`: it survives service-worker restarts
 * within a browser session but is cleared when Chrome closes, so captured data
 * and settings always reset to defaults on a fresh launch.
 */

const AREA = chrome.storage.session;

export function loadSettings(): Promise<CaptureSettings> {
  return AREA.get(STORAGE_KEYS.settings).then((res) => {
    const stored = res[STORAGE_KEYS.settings] as Partial<CaptureSettings> | undefined;
    return {
      ...DEFAULT_SETTINGS,
      ...(stored ?? {}),
    };
  });
}

export function saveSettings(settings: CaptureSettings): Promise<void> {
  return AREA.set({ [STORAGE_KEYS.settings]: settings });
}

export function loadRequests(): Promise<MarketingRequest[]> {
  return AREA.get(STORAGE_KEYS.requests).then((res) => {
    const stored = res[STORAGE_KEYS.requests] as MarketingRequest[] | undefined;
    return Array.isArray(stored) ? stored : [];
  });
}

export function saveRequests(requests: MarketingRequest[]): Promise<void> {
  return AREA.set({ [STORAGE_KEYS.requests]: requests });
}

export function loadSnapshot(): Promise<CaptureSnapshot> {
  return Promise.all([loadRequests(), loadSettings()]).then(
    ([requests, settings]) => ({ requests, settings })
  );
}

export function clearStorage(): Promise<void> {
  return AREA.remove([STORAGE_KEYS.requests]);
}

/** Debounce helper for batched storage writes. */
export function createFlusher<T>(write: (value: T) => Promise<void>, delayMs = 250) {
  let current: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      const value = current;
      current = undefined;
      if (value !== undefined) void write(value);
    }, delayMs);
  }

  return {
    push(value: T) {
      current = value;
      schedule();
    },
    async flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      const value = current;
      current = undefined;
      if (value !== undefined) await write(value);
    },
  };
}