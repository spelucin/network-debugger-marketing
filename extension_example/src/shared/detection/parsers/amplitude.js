// Amplitude Parsing Utilities
// Extracts event data from Amplitude API requests

/**
 * Parse Amplitude events from request data
 * Amplitude can send events via multiple formats:
 * - JSON body with events array
 * - URL-encoded form data with e/events parameter
 * - URL query parameters
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Amplitude data with events array and apiKey
 */
export function parseAmplitudeRequestData(url, postData) {
  let events = [];
  let apiKey = null;

  const urlObj = new URL(url);

  // Try multiple parsing strategies
  // Strategy 1: JSON body with events array
  if (postData) {
    try {
      const body = JSON.parse(postData);
      apiKey = body.api_key;
      if (body.events && Array.isArray(body.events)) {
        events = body.events;
      }
    } catch (e) {
      // Not JSON, try other formats
    }
  }

  // Strategy 2: URL-encoded form data
  if (events.length === 0 && postData) {
    try {
      const params = new URLSearchParams(postData);
      apiKey = params.get('api_key') || apiKey;
      const eventsStr = params.get('e') || params.get('events');
      if (eventsStr) {
        events = JSON.parse(eventsStr);
      }
      // Also try 'event' for single event
      const eventStr = params.get('event');
      if (eventStr && events.length === 0) {
        const singleEvent = JSON.parse(eventStr);
        events = Array.isArray(singleEvent) ? singleEvent : [singleEvent];
      }
    } catch (e) {
      // Parsing failed
    }
  }

  // Strategy 3: URL query parameters
  if (events.length === 0) {
    apiKey = urlObj.searchParams.get('api_key') || apiKey;
    const eventsStr = urlObj.searchParams.get('e') || urlObj.searchParams.get('events');
    if (eventsStr) {
      try {
        events = JSON.parse(decodeURIComponent(eventsStr));
      } catch (e) {
        // Parsing failed
      }
    }
  }

  // Strategy 4: Check if the whole postData is an event array
  if (events.length === 0 && postData) {
    try {
      const parsed = JSON.parse(postData);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].event_type) {
        events = parsed;
      }
    } catch (e) {
      // Not an array
    }
  }

  // Transform events to standardized format
  const parsedEvents = events.map(event => ({
    eventName: event.event_type || 'Unknown Event',
    userId: event.user_id,
    deviceId: event.device_id,
    sessionId: event.session_id,
    eventProperties: event.event_properties || {},
    userProperties: event.user_properties || {},
    rawEvent: event
  }));

  return {
    events: parsedEvents,
    apiKey,
    postData,
    detectedBy: 'URL matches Amplitude API endpoint'
  };
}
