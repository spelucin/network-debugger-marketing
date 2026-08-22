// Mixpanel Parsing Utilities
// Extracts event data from Mixpanel API requests

/**
 * Parse Mixpanel events from request data
 * Mixpanel typically sends base64-encoded JSON in 'data' parameter
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Mixpanel data
 */
export function parseMixpanelRequestData(url, postData) {
  const urlObj = new URL(url);
  let events = [];
  let token = null;

  // Determine region from URL
  let region = 'US';
  if (urlObj.hostname.includes('-eu.')) {
    region = 'EU';
  } else if (urlObj.hostname.includes('-in.')) {
    region = 'India';
  }

  // Try POST body first
  if (postData) {
    try {
      // Try direct JSON
      const body = JSON.parse(postData);
      if (Array.isArray(body)) {
        events = body;
        token = body[0]?.properties?.token;
      } else if (body.data) {
        // data field contains base64 encoded JSON
        const decoded = JSON.parse(atob(body.data));
        events = Array.isArray(decoded) ? decoded : [decoded];
        token = body.token || decoded.properties?.token;
      }
    } catch (e) {
      // Try URL-encoded format
      try {
        const params = new URLSearchParams(postData);
        const dataStr = params.get('data');
        if (dataStr) {
          const decoded = JSON.parse(atob(dataStr));
          events = Array.isArray(decoded) ? decoded : [decoded];
          token = params.get('token') || decoded.properties?.token;
        }
      } catch (e2) {
        // Parsing failed
      }
    }
  }

  // Try URL query parameters
  if (events.length === 0) {
    const dataStr = urlObj.searchParams.get('data');
    if (dataStr) {
      try {
        const decoded = JSON.parse(atob(dataStr));
        events = Array.isArray(decoded) ? decoded : [decoded];
        token = urlObj.searchParams.get('token') || decoded.properties?.token;
      } catch (e) {
        // Parsing failed
      }
    }
  }

  // Transform events to standardized format
  const parsedEvents = events.map(event => ({
    eventName: event.event || 'Unknown Event',
    distinctId: event.properties?.distinct_id,
    properties: event.properties || {},
    rawEvent: event
  }));

  return {
    events: parsedEvents,
    token,
    region,
    postData,
    detectedBy: 'URL matches Mixpanel endpoint'
  };
}
