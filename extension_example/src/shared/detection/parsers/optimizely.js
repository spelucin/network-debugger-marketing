// Optimizely Parsing Utilities
// Extracts event data from logx.optimizely.com/v1/events requests
// Docs: https://docs.developers.optimizely.com/experimentation-data/reference/post_events

/**
 * Parse an Optimizely event request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Optimizely data
 */
export function parseOptimizelyData(url, postData) {
  let body = null;
  if (postData) {
    try {
      body = JSON.parse(postData);
    } catch (e) { /* not JSON */ }
  }

  // Extract data from the nested structure
  const accountId = body?.account_id;
  const visitors = body?.visitors || [];
  const firstVisitor = visitors[0];
  const firstSnapshot = firstVisitor?.snapshots?.[0];
  const decisions = firstSnapshot?.decisions || [];
  const bodyEvents = firstSnapshot?.events || [];
  const firstEvent = bodyEvents[0];

  // Determine event name
  let eventName = 'Request';
  if (firstEvent?.key) {
    eventName = firstEvent.key === 'campaign_activated' ? 'Campaign Activated' : firstEvent.key;
  }

  // Build overview
  const overview = {};
  if (accountId) overview['Account ID'] = accountId;
  if (firstVisitor?.visitor_id) overview['Visitor ID'] = firstVisitor.visitor_id;
  if (decisions.length > 0) {
    overview['Experiments'] = String(decisions.length);
  }
  if (bodyEvents.length > 1) {
    overview['Events in Batch'] = String(bodyEvents.length);
  }
  if (firstEvent?.revenue !== undefined) {
    overview['Revenue'] = String(firstEvent.revenue);
  }

  // --- Custom Data: event tags (user-defined business data) ---
  const customData = {};
  if (firstEvent?.tags && typeof firstEvent.tags === 'object' && Object.keys(firstEvent.tags).length > 0) {
    customData['Event Tags'] = firstEvent.tags;
  }

  // Additional events' tags (if batched)
  if (bodyEvents.length > 1) {
    for (let i = 1; i < bodyEvents.length; i++) {
      const evt = bodyEvents[i];
      if (evt?.tags && Object.keys(evt.tags).length > 0) {
        customData[`Event ${i + 1} Tags (${evt.key || 'unknown'})`] = evt.tags;
      }
    }
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Experiment Decisions (the core debugging value)
  if (decisions.length > 0) {
    const decisionData = {};
    decisions.forEach((d, i) => {
      const prefix = decisions.length > 1 ? `[${i + 1}] ` : '';
      if (d.campaign_id) decisionData[`${prefix}Campaign ID`] = d.campaign_id;
      if (d.experiment_id) decisionData[`${prefix}Experiment ID`] = d.experiment_id;
      if (d.variation_id) decisionData[`${prefix}Variation ID`] = d.variation_id;
      if (d.metadata) {
        if (d.metadata.rule_key) decisionData[`${prefix}Rule Key`] = d.metadata.rule_key;
        if (d.metadata.rule_type) decisionData[`${prefix}Rule Type`] = d.metadata.rule_type;
        if (d.metadata.variation_key) decisionData[`${prefix}Variation Key`] = d.metadata.variation_key;
        if (d.metadata.flag_key) decisionData[`${prefix}Flag Key`] = d.metadata.flag_key;
        if (d.metadata.enabled !== undefined) decisionData[`${prefix}Enabled`] = String(d.metadata.enabled);
      }
    });
    if (Object.keys(decisionData).length > 0) {
      groupedParams['Experiment Decisions'] = decisionData;
    }
  }

  // Events
  if (bodyEvents.length > 0) {
    const eventData = {};
    bodyEvents.forEach((evt, i) => {
      const prefix = bodyEvents.length > 1 ? `[${i + 1}] ` : '';
      if (evt.key) eventData[`${prefix}Event Key`] = evt.key;
      if (evt.type) eventData[`${prefix}Event Type`] = evt.type;
      if (evt.entity_id) eventData[`${prefix}Entity ID`] = evt.entity_id;
      if (evt.revenue !== undefined) eventData[`${prefix}Revenue`] = String(evt.revenue);
      if (evt.value !== undefined) eventData[`${prefix}Value`] = String(evt.value);
      if (evt.uuid) eventData[`${prefix}UUID`] = evt.uuid;
      if (evt.timestamp) eventData[`${prefix}Timestamp`] = String(evt.timestamp);
    });
    if (Object.keys(eventData).length > 0) {
      groupedParams['Events'] = eventData;
    }
  }

  // Identity
  const identity = {};
  if (accountId) identity['Account ID (account_id)'] = accountId;
  if (firstVisitor?.visitor_id) identity['Visitor ID (visitor_id)'] = firstVisitor.visitor_id;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Visitor Attributes
  if (firstVisitor?.attributes && firstVisitor.attributes.length > 0) {
    const attrData = {};
    for (const attr of firstVisitor.attributes) {
      const label = attr.key || attr.entity_id || 'unknown';
      attrData[`${label}`] = attr.value !== undefined ? (typeof attr.value === 'object' ? JSON.stringify(attr.value) : String(attr.value)) : '';
    }
    if (Object.keys(attrData).length > 0) {
      groupedParams['Visitor Attributes'] = attrData;
    }
  }

  // SDK Info
  const sdkInfo = {};
  if (body?.client_name) sdkInfo['Client Name (client_name)'] = body.client_name;
  if (body?.client_version) sdkInfo['Client Version (client_version)'] = body.client_version;
  if (body?.anonymize_ip !== undefined) sdkInfo['Anonymize IP (anonymize_ip)'] = String(body.anonymize_ip);
  if (body?.enrich_decisions !== undefined) sdkInfo['Enrich Decisions (enrich_decisions)'] = String(body.enrich_decisions);
  if (body?.revision) sdkInfo['Revision (revision)'] = body.revision;
  if (body?.project_id) sdkInfo['Project ID (project_id)'] = body.project_id;
  if (Object.keys(sdkInfo).length > 0) {
    groupedParams['SDK'] = sdkInfo;
  }

  const detectedBy = 'URL contains logx.optimizely.com/v1/events';

  return {
    eventName,
    accountId,
    overview,
    customData,
    groupedParams,
    params: Object.fromEntries(new URL(url).searchParams),
    postData: body,
    detectedBy
  };
}
