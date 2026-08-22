// Isolated-world relay: forwards main-world capture events to the background
// worker. Kept separate from the MAIN-world script because only isolated
// content scripts can use chrome.runtime messaging.
const TOKEN = "nd-mainworld";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as
    | {
        source?: string;
        kind?: string;
        method?: string;
        url?: string;
        bodyText?: string;
      }
    | undefined;
  if (!data || data.source !== TOKEN) return;

  void chrome.runtime
    .sendMessage({
      type: "mainworld-request",
      payload: {
        kind: data.kind === "xhr" ? "xhr" : data.kind === "beacon" ? "beacon" : "fetch",
        method: typeof data.method === "string" ? data.method : "GET",
        url: String(data.url ?? ""),
        bodyText: typeof data.bodyText === "string" ? data.bodyText : undefined,
      },
    })
    .catch(() => undefined);
});
