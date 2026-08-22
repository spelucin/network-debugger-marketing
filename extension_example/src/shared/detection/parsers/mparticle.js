// mParticle Parsing Utilities
// Extracts event data from mParticle Web SDK and S2S API requests

/**
 * Map mParticle event_type enum to human-readable label
 * @param {string} eventType - The event_type value
 * @returns {string} Human-readable type
 */
function formatEventType(eventType) {
  const types = {
    custom_event: 'Custom Event',
    screen_view: 'Screen View',
    commerce_event: 'Commerce Event',
    session_start: 'Session Start',
    session_end: 'Session End',
    user_attribute_change: 'User Attribute Change',
    user_identity_change: 'User Identity Change',
    opt_out: 'Opt Out',
    push_registration: 'Push Registration',
    application_state_transition: 'App State Transition',
    first_run: 'First Run'
  };
  return types[eventType] || eventType || 'Unknown';
}

/**
 * Build a human-readable event name from an mParticle event
 * @param {Object} event - Raw mParticle event object
 * @returns {string} Human-readable event name
 */
function buildEventName(event) {
  const type = event.event_type;
  const data = event.data || {};

  if (type === 'custom_event') {
    return data.event_name || 'Custom Event';
  }
  if (type === 'commerce_event') {
    const action = data.product_action?.action || data.promotion_action?.action;
    return action ? `Commerce: ${action}` : 'Commerce Event';
  }
  if (type === 'screen_view') {
    return data.screen_name ? `Screen: ${data.screen_name}` : 'Screen View';
  }
  return formatEventType(type);
}

/**
 * Parse mParticle events from request data
 * mParticle uses a batch-centric model: one user context with multiple events
 *
 * Web SDK: POST https://jssdks.mparticle.com/v3/JS/<API_KEY>/events
 * S2S:     POST https://s2s.mparticle.com/v2/events
 *          POST https://s2s.mparticle.com/v2/bulkevents
 *
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed mParticle data with events array
 */
export function parseMparticleRequestData(url, postData) {
  const urlObj = new URL(url);
  let events = [];
  let userIdentities = null;
  let userAttributes = null;
  let deviceInfo = null;
  let applicationInfo = null;
  let consentState = null;
  let context = null;
  let environment = null;
  let apiKey = null;
  let mpid = null;
  let mpDeviceId = null;
  let sdkVersion = null;

  // Extract API key from URL path (version-agnostic)
  // Standard: /v3/JS/<KEY>/events
  // CNAME:    /webevents/v3/JS/<KEY>/events or any path with /JS/<KEY>/events
  const keyMatch = urlObj.pathname.match(/\/JS\/([a-z]{2}\d+-[0-9a-f]+)\//i);
  if (keyMatch) {
    apiKey = keyMatch[1];
  }

  // Extract batch-level fields from a batch object
  function extractBatchFields(batch) {
    userIdentities = batch.user_identities;
    userAttributes = batch.user_attributes;
    deviceInfo = batch.device_info;
    applicationInfo = batch.application_info;
    consentState = batch.consent_state;
    context = batch.context;
    environment = batch.environment;
    mpid = batch.mpid;
    mpDeviceId = batch.mp_deviceid;
    sdkVersion = batch.sdk_version;
  }

  // Try to parse POST body as JSON
  if (postData) {
    try {
      const body = JSON.parse(postData);

      // S2S bulk format: array of batches
      if (Array.isArray(body)) {
        if (body.length > 0) {
          extractBatchFields(body[0]);
          body.forEach(batch => {
            if (batch.events && Array.isArray(batch.events)) {
              events.push(...batch.events);
            }
          });
        }
      } else if (body.events && Array.isArray(body.events)) {
        // Standard batch format: single batch with events array
        events = body.events;
        extractBatchFields(body);
      } else if (body.event_type) {
        // Single event (rare but possible)
        events = [body];
      }
    } catch (e) {
      // Not JSON
    }
  }

  // Transform events to standardized format
  const parsedEvents = events.map(event => {
    const data = event.data || {};

    // Extract event-level metadata (everything in data except custom_attributes)
    const eventData = {};
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'custom_attributes' && key !== 'custom_flags' &&
          value !== null && value !== undefined) {
        eventData[key] = value;
      }
    }

    return {
      eventName: buildEventName(event),
      eventType: event.event_type,
      customEventType: data.custom_event_type,
      customAttributes: data.custom_attributes || {},
      eventData,
      rawEvent: event
    };
  });

  return {
    events: parsedEvents,
    userIdentities: userIdentities || {},
    userAttributes: userAttributes || {},
    deviceInfo: deviceInfo || {},
    applicationInfo: applicationInfo || {},
    consentState: consentState || null,
    context: context || null,
    environment,
    apiKey,
    mpid,
    mpDeviceId,
    sdkVersion,
    postData,
    detectedBy: urlObj.hostname.includes('mparticle.com')
      ? 'URL matches mParticle API endpoint'
      : `mParticle detected via path pattern on ${urlObj.hostname} (first-party proxy)`
  };
}
