// MV3 suspends this worker after ~30s idle, and observational webRequest
// events do not reliably wake it (crbug 40107353) — so with the panel closed
// a page's tracking burst would be missed entirely. Any extension API call
// resets the idle timer, so a cheap self-ping every 20s keeps the worker
// alive for the whole browser session while capture is enabled.

const KEEPALIVE_ALARM = "nd-keepalive";
const PING_INTERVAL_MS = 20_000;

let pingTimer: ReturnType<typeof setInterval> | undefined;
let captureEnabled = false;

function ping() {
  void chrome.runtime.getPlatformInfo().catch(() => undefined);
}

export function startKeepalive() {
  if (pingTimer) return;
  ping();
  pingTimer = setInterval(ping, PING_INTERVAL_MS);
}

export function stopKeepalive() {
  if (!pingTimer) return;
  clearInterval(pingTimer);
  pingTimer = undefined;
}

/** Keep the worker alive only while capture is enabled. */
export function syncKeepalive(enabled: boolean) {
  captureEnabled = enabled;
  if (enabled) startKeepalive();
  else stopKeepalive();
}

// Backup for hard kills that also stop timers (e.g. OS sleep on Windows):
// the alarm wakes the worker and re-arms the ping loop. Guarded so a missing
// alarms API (stale manifest without the permission) can never kill the
// worker at module evaluation.
try {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== KEEPALIVE_ALARM) return;
    if (captureEnabled) startKeepalive();
  });
} catch (error) {
  console.error("[Network Decoder] keepalive alarm unavailable:", error);
}
