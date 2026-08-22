// Adobe Target Parsing Utilities
// Extracts event data from Adobe Target Delivery API requests

/**
 * Parse Adobe Target Delivery API request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body (JSON)
 * @returns {Object} Parsed Adobe Target data
 */
export function parseAdobeTargetRequestData(url, postData = null) {
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

  // Extract key identifiers from URL params
  const clientCode = urlParams.client;
  const sessionId = urlParams.sessionId;
  const version = urlParams.version;

  // Determine request type and event name from body structure
  let eventName = 'Delivery Request';
  const requestTypes = [];

  if (body) {
    // Check execute section
    if (body.execute) {
      if (body.execute.pageLoad) {
        requestTypes.push('Page Load');
      }
      if (body.execute.mboxes && body.execute.mboxes.length > 0) {
        const mboxNames = body.execute.mboxes.map(m => m.name || 'mbox').slice(0, 3);
        requestTypes.push(`Execute: ${mboxNames.join(', ')}`);
      }
    }

    // Check prefetch section
    if (body.prefetch) {
      if (body.prefetch.views && body.prefetch.views.length > 0) {
        requestTypes.push('Prefetch Views');
      }
      if (body.prefetch.mboxes && body.prefetch.mboxes.length > 0) {
        const mboxNames = body.prefetch.mboxes.map(m => m.name || 'mbox').slice(0, 3);
        requestTypes.push(`Prefetch: ${mboxNames.join(', ')}`);
      }
      if (body.prefetch.pageLoad) {
        requestTypes.push('Prefetch Page');
      }
    }

    // Check notifications (conversion/display tracking)
    if (body.notifications && body.notifications.length > 0) {
      const notifTypes = [...new Set(body.notifications.map(n => n.type || 'notification'))];
      requestTypes.push(`Notify: ${notifTypes.join(', ')}`);
    }
  }

  // Build event name from request types
  if (requestTypes.length > 0) {
    eventName = requestTypes.join(' + ');
  }

  // Build overview
  const overview = {};
  if (clientCode) overview['Client'] = clientCode;
  if (sessionId) overview['Session ID'] = sessionId;

  // Extract IDs from body
  if (body?.id) {
    if (body.id.tntId) overview['TNT ID'] = body.id.tntId;
    if (body.id.marketingCloudVisitorId) overview['MCID'] = body.id.marketingCloudVisitorId;
    if (body.id.thirdPartyId) overview['Third Party ID'] = body.id.thirdPartyId;
  }

  // Extract property token
  if (body?.property?.token) {
    overview['Property Token'] = body.property.token;
  }

  // Build sections for structured display (standard layout)
  const sections = [];

  // Execute section — nested mbox data, keep as JSON
  if (body?.execute) {
    const executeData = {};
    if (body.execute.pageLoad) {
      executeData['Page Load'] = Object.keys(body.execute.pageLoad).length > 0
        ? body.execute.pageLoad
        : true;
    }
    if (body.execute.mboxes) {
      executeData['Mboxes'] = body.execute.mboxes.map(m => ({
        name: m.name,
        index: m.index,
        parameters: m.parameters
      })).filter(m => m.name || m.parameters);
    }
    if (Object.keys(executeData).length > 0) {
      sections.push({ title: 'Execute', data: executeData });
    }
  }

  // Prefetch section — nested mbox data, keep as JSON
  if (body?.prefetch) {
    const prefetchData = {};
    if (body.prefetch.views) {
      prefetchData['Views'] = body.prefetch.views.length > 0 ? body.prefetch.views : true;
    }
    if (body.prefetch.mboxes) {
      prefetchData['Mboxes'] = body.prefetch.mboxes.map(m => ({
        name: m.name,
        index: m.index,
        parameters: m.parameters
      })).filter(m => m.name || m.parameters);
    }
    if (body.prefetch.pageLoad) {
      prefetchData['Page Load'] = true;
    }
    if (Object.keys(prefetchData).length > 0) {
      sections.push({ title: 'Prefetch', data: prefetchData });
    }
  }

  // Notifications section — tracking events, keep as JSON
  if (body?.notifications && body.notifications.length > 0) {
    const notifData = body.notifications.map(n => ({
      id: n.id,
      type: n.type,
      timestamp: n.timestamp,
      mbox: n.mbox?.name,
      tokens: n.tokens
    }));
    sections.push({ title: 'Notifications', data: notifData });
  }

  // 4. Parsed Data — system/protocol data as grouped params
  const groupedParams = {};

  // Context group
  if (body?.context) {
    const contextData = {};
    if (body.context.channel) contextData['Channel (context.channel)'] = body.context.channel;
    if (body.context.browser?.host) contextData['Host (context.browser.host)'] = body.context.browser.host;
    if (body.context.address?.url) contextData['URL (context.address.url)'] = body.context.address.url;
    if (body.context.address?.referringUrl) contextData['Referrer (context.address.referringUrl)'] = body.context.address.referringUrl;
    if (body.context.screen) {
      contextData['Screen (context.screen)'] = `${body.context.screen.width}x${body.context.screen.height}`;
    }
    if (body.context.window) {
      contextData['Window (context.window)'] = `${body.context.window.width}x${body.context.window.height}`;
    }
    if (Object.keys(contextData).length > 0) {
      groupedParams['Context'] = contextData;
    }
  }

  // Experience Cloud group
  if (body?.experienceCloud) {
    const ecData = {};
    if (body.experienceCloud.analytics?.supplementalDataId) {
      ecData['Analytics SDID (analytics.supplementalDataId)'] = body.experienceCloud.analytics.supplementalDataId;
    }
    if (body.experienceCloud.audienceManager?.locationHint) {
      ecData['AAM Location Hint (audienceManager.locationHint)'] = body.experienceCloud.audienceManager.locationHint;
    }
    if (Object.keys(ecData).length > 0) {
      groupedParams['Experience Cloud'] = ecData;
    }
  }

  // Identifiers group
  if (body?.id) {
    const idData = {};
    if (body.id.tntId) idData['TNT ID (id.tntId)'] = body.id.tntId;
    if (body.id.marketingCloudVisitorId) idData['Marketing Cloud ID (id.marketingCloudVisitorId)'] = body.id.marketingCloudVisitorId;
    if (body.id.thirdPartyId) idData['Third Party ID (id.thirdPartyId)'] = body.id.thirdPartyId;
    if (body.id.customerIds && body.id.customerIds.length > 0) {
      idData['Customer IDs'] = body.id.customerIds;
    }
    if (Object.keys(idData).length > 0) {
      groupedParams['Identifiers'] = idData;
    }
  }

  // Request group — URL-level parameters
  const requestData = {};
  if (body?.requestId) requestData['Request ID (requestId)'] = body.requestId;
  if (clientCode) requestData['Client (client)'] = clientCode;
  if (sessionId) requestData['Session ID (sessionId)'] = sessionId;
  if (version) requestData['API Version (version)'] = version;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  return {
    eventName,
    overview,
    params: groupedParams,
    parsedDisplayMode: 'table',
    sections,
    rawParams: urlParams,
    postData
  };
}
