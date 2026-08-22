import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CaptureSettings,
  CaptureSnapshot,
  MarketingRequest,
} from "../../core/types";
import { DEFAULT_SETTINGS } from "../../core/types";
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
  const [activeTabId, setActiveTabId] = useState<number | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const alive = useRef(true);

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
      }
      const st = changes[STORAGE_KEYS.settings];
      if (st) {
        setSettings({ ...DEFAULT_SETTINGS, ...(st.newValue as Partial<CaptureSettings>) });
      }
      const tab = changes[STORAGE_KEYS.activeTab];
      if (tab) {
        setActiveTabId(typeof tab.newValue === "number" ? tab.newValue : undefined);
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      alive.current = false;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

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