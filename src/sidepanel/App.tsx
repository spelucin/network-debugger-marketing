import { useCallback, useEffect, useMemo, useState } from "react";
import { useCapture } from "./hooks/useCapture";
import { Header } from "./components/Header";
import { FilterBar } from "./components/FilterBar";
import { RequestList, type ListView } from "./components/RequestList";
import { Detail } from "./components/Detail";
import { SettingsOverlay } from "./components/SettingsOverlay";
import { EmptyState } from "./components/EmptyState";
import { StatsFooter } from "./components/StatsFooter";
import { DEFAULT_FILTERS, filterByTab, filterRequests, type FilterState } from "./lib/filters";

export function App() {
  const {
    requests,
    settings,
    stats,
    captureEnabled,
    recordThisTab,
    recordAllTabs,
    activeTabId,
    setCapturing,
    setRecordScope,
    updateSettings,
    clear,
    clearTab,
  } = useCapture();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showSettings, setShowSettings] = useState(false);

  // The panel reflects the current tab unless recording across all tabs. The
  // global list is never mutated, so recording keeps every tab's history.
  const visibleRequests = useMemo(
    () => (recordAllTabs ? requests : filterByTab(requests, activeTabId)),
    [requests, recordAllTabs, activeTabId]
  );

  // Theme: manual override or follow the system.
  useEffect(() => {
    const apply = () => {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark =
        settings.theme === "dark" ||
        (settings.theme === "system" && systemDark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  // Keep the background service worker alive for as long as the panel is
  // open, so a freshly-awoken worker never misses the burst of tracking that
  // fires when a page loads.
  useEffect(() => {
    let port: chrome.runtime.Port | undefined;
    try {
      port = chrome.runtime.connect({ name: "nd-keepalive" });
    } catch {
      // Some contexts reject connecting; capture still works on the next wake.
    }
    return () => {
      try {
        port?.disconnect();
      } catch {
        // ignore
      }
    };
  }, []);

  const filtered = useMemo(
    () => filterRequests(visibleRequests, filters),
    [visibleRequests, filters]
  );

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId]
  );

  // Close the detail view if the selected request is no longer on screen
  // (e.g. the user switched to another tab).
  useEffect(() => {
    if (selectedId && selected && selected.tabId !== undefined && activeTabId !== undefined) {
      if (selected.tabId !== activeTabId && !recordAllTabs) setSelectedId(null);
    }
  }, [selectedId, selected, activeTabId, recordAllTabs]);

  const handleClear = useCallback(() => {
    setSelectedId(null);
    setFilters(DEFAULT_FILTERS);
    clear();
  }, [clear]);

  // Reload the active tab after dropping its captured requests, so recording
  // is genuinely "since page load".
  const reloadActiveTab = useCallback(() => {
    if (activeTabId !== undefined) {
      void chrome.tabs?.reload(activeTabId).catch(() => undefined);
    }
  }, [activeTabId]);

  const handleRefreshTab = useCallback(() => {
    if (activeTabId !== undefined) {
      setSelectedId(null);
      clearTab(activeTabId);
    }
    reloadActiveTab();
  }, [activeTabId, clearTab, reloadActiveTab]);

  return (
    <div className="app">
      <Header
        requests={visibleRequests}
        captureEnabled={captureEnabled}
        recordThisTab={recordThisTab}
        recordAllTabs={recordAllTabs}
        onSetRecordScope={setRecordScope}
        onClear={handleClear}
        onOpenSettings={() => setShowSettings(true)}
        onRefreshTab={handleRefreshTab}
        activeTabId={activeTabId}
      />

      {!selected ? (
        <>
          <FilterBar
            filters={filters}
            requests={visibleRequests}
            captureEnabled={captureEnabled}
            onToggleCapture={() => setCapturing(!captureEnabled)}
            onFiltersChange={setFilters}
            view={settings.listView}
            onViewChange={(view: ListView) => updateSettings({ listView: view })}
          />
          {visibleRequests.length === 0 ? (
            <EmptyState
              captureEnabled={captureEnabled}
              recording={recordThisTab || recordAllTabs}
              onStart={() => setCapturing(true)}
              onReload={handleRefreshTab}
            />
          ) : (
            <>
              <RequestList
                requests={filtered}
                view={settings.listView}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <StatsFooter perf={stats.perf} />
            </>
          )}
        </>
      ) : (
        <Detail request={selected} onBack={() => setSelectedId(null)} />
      )}

      {showSettings && (
        <SettingsOverlay
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}