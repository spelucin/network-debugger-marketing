import { define, type ParameterDefinition } from "./types";

export const MIXPANEL_DOCS =
  "https://docs.mixpanel.com/docs/track/events";

export const MIXPANEL_DEFINITIONS: ParameterDefinition[] = [
  define(
    "event",
    "Event Name",
    "The name of the event being tracked.",
    "standard"
  ),
  define(
    "distinct_id",
    "Distinct ID",
    "Unique identifier for the user.",
    "context",
    { type: "id" }
  ),
  define(
    "device_id",
    "Device ID",
    "Unique identifier for the device.",
    "context",
    { type: "id" }
  ),
  define(
    "session_id",
    "Session ID",
    "Unique identifier for the session.",
    "context",
    { type: "id" }
  ),
  define(
    "token",
    "Project Token",
    "The Mixpanel project token used for authentication.",
    "context",
    { type: "id" }
  ),
  define(
    "time",
    "Timestamp",
    "Unix timestamp of when the event occurred.",
    "context",
    { type: "timestamp" }
  ),
  define(
    "properties",
    "Event Properties",
    "Arbitrary key-value properties attached to the event.",
    "custom",
    { type: "json" }
  ),
  define(
    "mp_lib",
    "SDK Library",
    "The SDK library used to send the event (e.g. web, python, node).",
    "context"
  ),
  define(
    "mp_version",
    "SDK Version",
    "The version of the SDK library.",
    "context"
  ),
  define(
    "initial_referrer",
    "Initial Referrer",
    "The initial referrer URL when the user first visited the site.",
    "context",
    { type: "url" }
  ),
  define(
    "referrer",
    "Referrer",
    "The referrer URL for the current page view.",
    "context",
    { type: "url" }
  ),
  define(
    "referring_domain",
    "Referring Domain",
    "The domain that referred the user to the site.",
    "context"
  ),
  define(
    "screen_height",
    "Screen Height",
    "The screen height of the user's device in pixels.",
    "context",
    { type: "number" }
  ),
  define(
    "screen_width",
    "Screen Width",
    "The screen width of the user's device in pixels.",
    "context",
    { type: "number" }
  ),
  define(
    "browser",
    "Browser",
    "The browser the user is using.",
    "context"
  ),
  define(
    "browser_version",
    "Browser Version",
    "The version of the browser.",
    "context"
  ),
  define(
    "os",
    "Operating System",
    "The operating system of the user's device.",
    "context"
  ),
  define(
    "os_version",
    "OS Version",
    "The version of the operating system.",
    "context"
  ),
];

export const MIXPANEL_DEFINITION_MAP = new Map(
  MIXPANEL_DEFINITIONS.map((d) => [d.name, d])
);
