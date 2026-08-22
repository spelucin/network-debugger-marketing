// Adobe Experience Platform (Web SDK / Alloy) Parsing Utilities
// Extracts event data from AEP Edge Network requests (edge.adobedc.net)

/**
 * Map XDM eventType to a human-readable label
 */
const EVENT_TYPE_LABELS = {
  'web.webpagedetails.pageViews': 'Page View',
  'web.webinteraction.linkClicks': 'Link Click',
  'commerce.productViews': 'Product View',
  'commerce.productListAdds': 'Add to Cart',
  'commerce.productListRemovals': 'Remove from Cart',
  'commerce.productListViews': 'Product List View',
  'commerce.checkouts': 'Checkout',
  'commerce.purchases': 'Purchase',
  'commerce.order': 'Order',
  'commerce.saveForLaters': 'Save for Later',
  'commerce.productListOpens': 'Cart Open',
  'commerce.productListReopens': 'Cart Reopen',
  'commerce.instorePurchase': 'In-Store Purchase',
  'decisioning.propositionDisplay': 'Proposition Display',
  'decisioning.propositionInteract': 'Proposition Interact',
  'decisioning.propositionDismiss': 'Proposition Dismiss',
  'decisioning.propositionSend': 'Proposition Send',
  'media.sessionStart': 'Media Session Start',
  'media.play': 'Media Play',
  'media.pauseStart': 'Media Pause',
  'media.sessionEnd': 'Media Session End',
  'media.sessionComplete': 'Media Session Complete',
  'media.ping': 'Media Ping',
  'pushTracking.customAction': 'Push Custom Action',
  'listOperation': 'List Operation',
  'advertising.impressions': 'Ad Impression',
  'advertising.clicks': 'Ad Click',
  'advertising.completes': 'Ad Complete'
};

/**
 * Commerce action keys and their labels
 */
const COMMERCE_ACTION_LABELS = {
  productViews: 'Product Views',
  productListAdds: 'Add to Cart',
  productListRemovals: 'Remove from Cart',
  productListViews: 'Product List Views',
  checkouts: 'Checkouts',
  purchases: 'Purchases',
  order: 'Order',
  saveForLaters: 'Save for Later',
  productListOpens: 'Cart Opens',
  productListReopens: 'Cart Reopens',
  instorePurchase: 'In-Store Purchase',
  cartAbandons: 'Cart Abandons'
};

/**
 * Determine endpoint type from URL path
 * @param {URL} urlObj - Parsed URL
 * @returns {string} Endpoint type label
 */
function getEndpointType(urlObj) {
  const path = urlObj.pathname;
  if (path.includes('/interact')) return 'interact';
  if (path.includes('/collect')) return 'collect';
  return 'edge';
}

/**
 * Extract a readable event name from XDM data
 * @param {Object} xdm - XDM event data
 * @param {string} endpointType - 'interact' or 'collect'
 * @returns {string} Human-readable event name
 */
function getEventName(xdm, endpointType) {
  if (!xdm) {
    return endpointType === 'interact' ? 'Interact' : 'Collect';
  }

  const eventType = xdm.eventType;

  // Check known event type mappings
  if (eventType && EVENT_TYPE_LABELS[eventType]) {
    const label = EVENT_TYPE_LABELS[eventType];
    // Append page name for page views
    if (eventType === 'web.webpagedetails.pageViews' && xdm.web?.webPageDetails?.name) {
      return `${label}: ${xdm.web.webPageDetails.name}`;
    }
    return label;
  }

  // Use raw eventType if set but not in our map
  if (eventType) {
    return eventType;
  }

  // Infer from commerce actions
  if (xdm.commerce) {
    for (const [key, label] of Object.entries(COMMERCE_ACTION_LABELS)) {
      if (xdm.commerce[key]) return label;
    }
  }

  return endpointType === 'interact' ? 'Interact' : 'Collect';
}

/**
 * Parse a single AEP event object into structured data
 * @param {Object} event - Single event from request body
 * @param {string} endpointType - 'interact' or 'collect'
 * @param {Object} sharedContext - Shared context (datastream ID, org, etc.)
 * @returns {Object} Parsed event data
 */
function parseAEPEvent(event, endpointType, sharedContext) {
  const xdm = event.xdm || {};
  const data = event.data || {};
  const query = event.query || sharedContext.query || {};
  const meta = event.meta || sharedContext.meta || {};

  const eventName = getEventName(xdm, endpointType);

  // Build overview
  const overview = {};
  if (sharedContext.datastreamId) overview['Datastream ID'] = sharedContext.datastreamId;
  if (xdm.eventType) overview['Event Type'] = xdm.eventType;

  // Extract page name
  const pageName = xdm.web?.webPageDetails?.name;
  if (pageName) overview['Page Name'] = pageName;

  // Extract ECID from identityMap
  let ecid = null;
  if (xdm.identityMap?.ECID?.[0]?.id) {
    ecid = xdm.identityMap.ECID[0].id;
    overview['ECID'] = ecid;
  }

  // Build sections (standard layout)
  const sections = [];

  // 2. Custom Data — non-Adobe data fields from event.data
  const customData = {};

  // event.data excluding __adobe (custom implementation data)
  const customFields = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== '__adobe') {
      customFields[key] = value;
    }
  }
  if (Object.keys(customFields).length > 0) {
    customData['Event Data (data.*)'] = customFields;
  }

  // Adobe Analytics overrides (data.__adobe.analytics)
  if (data.__adobe?.analytics && Object.keys(data.__adobe.analytics).length > 0) {
    customData['Analytics Overrides (data.__adobe.analytics)'] = data.__adobe.analytics;
  }

  // Adobe Target data (data.__adobe.target)
  if (data.__adobe?.target && Object.keys(data.__adobe.target).length > 0) {
    customData['Target Data (data.__adobe.target)'] = data.__adobe.target;
  }

  if (Object.keys(customData).length > 0) {
    sections.push({ title: 'Custom Data', data: customData, type: 'table' });
  }

  // 3. E-Commerce Items — productListItems from XDM
  const items = xdm.productListItems || xdm.commerce?.productListItems;
  if (items && items.length > 0) {
    const itemsData = {};
    items.forEach((item, i) => {
      const itemEntry = {};
      if (item.name) itemEntry['Name'] = item.name;
      if (item.SKU) itemEntry['SKU'] = item.SKU;
      if (item.productURL) itemEntry['URL'] = item.productURL;
      if (item.quantity != null) itemEntry['Quantity'] = item.quantity;
      if (item.priceTotal != null) itemEntry['Price'] = item.priceTotal;
      if (item.currencyCode) itemEntry['Currency'] = item.currencyCode;
      // Include any extra fields
      for (const [key, value] of Object.entries(item)) {
        if (!['name', 'SKU', 'productURL', 'quantity', 'priceTotal', 'currencyCode'].includes(key)) {
          itemEntry[key] = value;
        }
      }
      itemsData[`Item ${i + 1}`] = itemEntry;
    });
    sections.push({
      title: `E-Commerce Items (${items.length})`,
      data: itemsData,
      type: 'table',
      sortRows: false
    });
  }

  // 4. Parsed Data — system/protocol data as grouped params
  const groupedParams = {};

  // Page Context group (from xdm.web)
  if (xdm.web) {
    const pageContext = {};
    if (xdm.web.webPageDetails?.URL) pageContext['Page URL (webPageDetails.URL)'] = xdm.web.webPageDetails.URL;
    if (xdm.web.webPageDetails?.name) pageContext['Page Name (webPageDetails.name)'] = xdm.web.webPageDetails.name;
    if (xdm.web.webPageDetails?.server) pageContext['Server (webPageDetails.server)'] = xdm.web.webPageDetails.server;
    if (xdm.web.webPageDetails?.siteSection) pageContext['Site Section (webPageDetails.siteSection)'] = xdm.web.webPageDetails.siteSection;
    if (xdm.web.webPageDetails?.isHomePage) pageContext['Is Home Page (webPageDetails.isHomePage)'] = 'Yes';
    if (xdm.web.webPageDetails?.isErrorPage) pageContext['Is Error Page (webPageDetails.isErrorPage)'] = 'Yes';
    if (xdm.web.webReferrer?.URL) pageContext['Referrer (webReferrer.URL)'] = xdm.web.webReferrer.URL;
    if (xdm.web.webInteraction?.name) pageContext['Interaction Name (webInteraction.name)'] = xdm.web.webInteraction.name;
    if (xdm.web.webInteraction?.type) pageContext['Interaction Type (webInteraction.type)'] = xdm.web.webInteraction.type;
    if (xdm.web.webInteraction?.URL) pageContext['Interaction URL (webInteraction.URL)'] = xdm.web.webInteraction.URL;
    if (Object.keys(pageContext).length > 0) {
      groupedParams['Page Context'] = pageContext;
    }
  }

  // Commerce group (action flags, not items)
  if (xdm.commerce) {
    const commerceData = {};
    for (const [key, label] of Object.entries(COMMERCE_ACTION_LABELS)) {
      if (xdm.commerce[key]) {
        const action = xdm.commerce[key];
        if (action.value != null) {
          commerceData[label] = action.value;
        } else if (typeof action === 'object' && Object.keys(action).length > 0) {
          // Order with ID, total, etc.
          for (const [subKey, subVal] of Object.entries(action)) {
            commerceData[`${label} — ${subKey}`] = subVal;
          }
        } else {
          commerceData[label] = true;
        }
      }
    }
    // Order details
    if (xdm.commerce.order) {
      if (xdm.commerce.order.purchaseID) commerceData['Purchase ID (commerce.order.purchaseID)'] = xdm.commerce.order.purchaseID;
      if (xdm.commerce.order.purchaseOrderNumber) commerceData['PO Number (commerce.order.purchaseOrderNumber)'] = xdm.commerce.order.purchaseOrderNumber;
      if (xdm.commerce.order.priceTotal != null) commerceData['Order Total (commerce.order.priceTotal)'] = xdm.commerce.order.priceTotal;
      if (xdm.commerce.order.currencyCode) commerceData['Currency (commerce.order.currencyCode)'] = xdm.commerce.order.currencyCode;
    }
    if (Object.keys(commerceData).length > 0) {
      groupedParams['Commerce'] = commerceData;
    }
  }

  // Identity group
  const identityData = {};
  if (xdm.identityMap) {
    for (const [namespace, ids] of Object.entries(xdm.identityMap)) {
      if (Array.isArray(ids) && ids.length > 0) {
        if (ids.length === 1) {
          const entry = ids[0];
          identityData[namespace] = entry.id;
          if (entry.authenticatedState && entry.authenticatedState !== 'ambiguous') {
            identityData[`${namespace} (state)`] = entry.authenticatedState;
          }
        } else {
          ids.forEach((entry, i) => {
            identityData[`${namespace} [${i + 1}]`] = entry.id;
          });
        }
      }
    }
  }
  if (Object.keys(identityData).length > 0) {
    groupedParams['Identity'] = identityData;
  }

  // Personalization group (from query)
  if (query.personalization) {
    const personalizationData = {};
    if (query.personalization.decisionScopes) {
      personalizationData['Decision Scopes (query.personalization.decisionScopes)'] = query.personalization.decisionScopes.join(', ');
    }
    if (query.personalization.surfaces) {
      personalizationData['Surfaces (query.personalization.surfaces)'] = query.personalization.surfaces.join(', ');
    }
    if (query.personalization.schemas) {
      personalizationData['Schemas (query.personalization.schemas)'] = query.personalization.schemas.length;
    }
    if (Object.keys(personalizationData).length > 0) {
      groupedParams['Personalization'] = personalizationData;
    }
  }

  // Configuration group
  const configData = {};
  if (sharedContext.datastreamId) configData['Datastream ID (configId)'] = sharedContext.datastreamId;
  if (sharedContext.orgId) configData['Org ID (orgId)'] = sharedContext.orgId;
  if (sharedContext.edgeDomain) configData['Edge Domain (hostname)'] = sharedContext.edgeDomain;
  configData['Endpoint'] = endpointType;
  if (meta.state?.domain) configData['Domain'] = meta.state.domain;
  if (meta.configOverrides) {
    // Flatten config overrides
    for (const [svc, overrides] of Object.entries(meta.configOverrides)) {
      if (overrides && typeof overrides === 'object') {
        for (const [key, val] of Object.entries(overrides)) {
          configData[`${svc}.${key}`] = Array.isArray(val) ? val.join(', ') : val;
        }
      }
    }
  }
  if (Object.keys(configData).length > 0) {
    groupedParams['Configuration'] = configData;
  }

  // Timing group
  const timingData = {};
  if (xdm.timestamp) timingData['Timestamp (xdm.timestamp)'] = xdm.timestamp;
  if (xdm._experience?.analytics?.session?.num) {
    timingData['Session Number (_experience.analytics.session.num)'] = xdm._experience.analytics.session.num;
  }
  if (Object.keys(timingData).length > 0) {
    groupedParams['Timing'] = timingData;
  }

  return {
    eventName,
    overview,
    sections,
    groupedParams
  };
}

/**
 * Parse an AEP Edge Network request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body (JSON)
 * @returns {Object} Parsed AEP data with events array
 */
export function parseAdobeAEPRequestData(url, postData = null) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);

  // Parse JSON body
  let body = null;
  if (postData) {
    try {
      body = JSON.parse(postData);
    } catch (e) {
      // Not valid JSON
    }
  }

  // Extract shared context from URL
  const datastreamId = urlParams.configId || urlParams.datastreamId || urlParams.dataStreamId;
  const orgId = urlParams.orgId;
  const endpointType = getEndpointType(urlObj);
  const edgeDomain = urlObj.hostname;

  const sharedContext = {
    datastreamId,
    orgId,
    edgeDomain,
    query: body?.query || {},
    meta: body?.meta || {}
  };

  // AEP can send single event or batched events
  const rawEvents = [];
  if (body?.events && Array.isArray(body.events)) {
    rawEvents.push(...body.events);
  } else if (body?.event) {
    rawEvents.push(body.event);
  } else if (body?.xdm) {
    // Some implementations send xdm at the top level
    rawEvents.push({ xdm: body.xdm, data: body.data });
  }

  // If no events found, create a minimal one
  if (rawEvents.length === 0) {
    rawEvents.push({});
  }

  // Parse each event
  const events = rawEvents.map(event => {
    const parsed = parseAEPEvent(event, endpointType, sharedContext);
    return {
      eventName: parsed.eventName,
      overview: parsed.overview,
      sections: parsed.sections,
      groupedParams: parsed.groupedParams,
      rawEvent: event
    };
  });

  return {
    events,
    endpointType,
    datastreamId,
    rawParams: urlParams,
    postData
  };
}
