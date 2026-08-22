// Segment Spec Parsing Utilities
// Shared parser for Segment, RudderStack, and Hightouch
// All three use the same "Segment spec" protocol with identical JSON structure

/**
 * Build a human-readable event name from a Segment-spec call
 * @param {Object} call - The raw call object
 * @returns {string} Human-readable event name
 */
function buildEventName(call) {
  const type = call.type || 'unknown';
  switch (type) {
    case 'track':
      return call.event || 'Unknown Event';
    case 'identify':
      return call.userId ? `Identify: ${call.userId}` : 'Identify';
    case 'page': {
      const pageName = call.name || call.properties?.name || call.properties?.path;
      return pageName ? `Page: ${pageName}` : 'Page';
    }
    case 'screen': {
      const screenName = call.name || call.properties?.name;
      return screenName ? `Screen: ${screenName}` : 'Screen';
    }
    case 'group': {
      const groupName = call.traits?.name || call.groupId;
      return groupName ? `Group: ${groupName}` : 'Group';
    }
    case 'alias':
      return call.userId ? `Alias: ${call.userId}` : 'Alias';
    default:
      return call.event || type;
  }
}

/**
 * Parse Segment-spec events from request data
 * Works for Segment, RudderStack, and Hightouch (all use same protocol)
 *
 * Formats supported:
 * - JSON body with single call: { type: "track", event: "...", ... }
 * - JSON body with batch: { batch: [{ type: "track", ... }, ...] }
 *
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed data with events array
 */
export function parseSegmentSpecRequestData(url, postData) {
  const urlObj = new URL(url);
  let calls = [];
  let writeKey = null;
  let library = null;

  // Try to parse POST body as JSON
  if (postData) {
    try {
      const body = JSON.parse(postData);

      // Batch endpoint: { batch: [...] }
      if (body.batch && Array.isArray(body.batch)) {
        calls = body.batch;
        writeKey = body.writeKey;
      } else if (body.type) {
        // Single call: { type: "track", event: "...", ... }
        calls = [body];
        writeKey = body.writeKey;
      }
    } catch (e) {
      // Not JSON — try URL-encoded form data
      try {
        const params = new URLSearchParams(postData);
        const dataStr = params.get('data');
        if (dataStr) {
          const decoded = JSON.parse(atob(dataStr));
          calls = Array.isArray(decoded) ? decoded : [decoded];
        }
      } catch (e2) {
        // Parsing failed
      }
    }
  }

  // Extract library info from first call's context
  if (calls.length > 0 && calls[0].context?.library) {
    const lib = calls[0].context.library;
    library = typeof lib === 'string' ? lib : lib.name;
  }

  // Transform calls to standardized format
  const parsedEvents = calls.map(call => {
    const type = call.type || 'track';

    // Properties for track/page/screen, traits for identify/group
    const properties = call.properties || {};
    const traits = call.traits || {};

    // Build context summary (flatten useful fields)
    const context = call.context || {};

    return {
      eventName: buildEventName(call),
      callType: type,
      userId: call.userId,
      anonymousId: call.anonymousId,
      groupId: call.groupId,
      properties,
      traits,
      context,
      integrations: call.integrations,
      messageId: call.messageId,
      timestamp: call.timestamp || call.originalTimestamp,
      rawEvent: call
    };
  });

  return {
    events: parsedEvents,
    writeKey,
    library,
    postData,
    detectedBy: 'URL matches Segment-spec API endpoint'
  };
}
