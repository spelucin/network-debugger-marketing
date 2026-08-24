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
    ready,
    setCapturing,
    setRecordScope,
    updateSettings,
    clear,
    clearTab,
  } = useCapture();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showSettings, setShowSettings] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Track the active tab's page loads: while a navigation is in flight and
  // nothing has been captured yet, the panel shows an intermediate loading
  // state instead of flashing the onboarding empty state.
  useEffect(() => {
    if (activeTabId === undefined) return;
    const onUpdated = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (tabId !== activeTabId) return;
      if (info.status === "loading") setNavigating(true);
      else if (info.status === "complete") setNavigating(false);
    };
    try {
      chrome.tabs.onUpdated.addListener(onUpdated);
    } catch {
      // tabs API unavailable in some contexts; loading state is cosmetic.
    }
    return () => {
      try {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      } catch {
        // ignore
      }
    };
  }, [activeTabId]);

  // The panel reflects the current tab unless recording across all tabs. The
  // global list is never mutated, so recording keeps every tab's history.
  const visibleRequests = useMemo(
    () => (recordAllTabs ? requests : filterByTab(requests, activeTabId)),
    [requests, recordAllTabs, activeTabId]
  );

  // Mid-navigation with nothing captured yet: capture-only mode just wiped
  // the view, so show the loading state rather than "no requests yet".
  const showNavigating =
    captureEnabled && navigating && visibleRequests.length === 0;

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

  // First paint while the worker hydrates: a skeleton shaped like the list,
  // so the panel never flashes an empty state that isn't real.
  if (!ready) {
    return (
      <div className="app">
        <div className="skeleton-header">
          <span className="skeleton-line" style={{ width: 96 }} />
          <span className="skeleton-line" style={{ width: 56 }} />
        </div>
        <div className="skeleton-list" aria-label="Loading captured requests">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="skeleton-badge" />
              <span className="skeleton-lines">
                <span className="skeleton-line" style={{ width: `${62 - (i % 3) * 9}%` }} />
                <span className="skeleton-line thin" style={{ width: `${40 + (i % 4) * 8}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
          {showNavigating ? (
            <NavigatingState />
          ) : visibleRequests.length === 0 ? (
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
/** Intermediate state while the active tab loads and capture-only mode has
 * just wiped the view: shimmer rows hint at the list that may arrive. */
function NavigatingState() {
  return (
    <div className="navigating-state" aria-live="polite" aria-label="Page loading">
      <div className="navigating-caption">
        <span className="navigating-dot" />
        Waiting for requests from this page…
      </div>
      <div className="navigating-rows">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="skeleton-badge" />
            <span className="skeleton-lines">
              <span className="skeleton-line" style={{ width: `${58 - (i % 3) * 8}%` }} />
              <span className="skeleton-line thin" style={{ width: `${36 + (i % 4) * 9}%` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
