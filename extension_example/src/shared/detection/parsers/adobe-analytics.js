// Adobe Analytics (Omniture) Parsing Utilities
// Extracts event data from Adobe Analytics /b/ss/ requests

/**
 * Parse Adobe Analytics s.products variable into structured data
 * Format: Category;Product;Quantity;Price;events;eVars (comma-separated for multiple products)
 * @param {string} productsString - The raw s.products string
 * @returns {Array<Object>} Array of parsed product objects
 */
export function parseAdobeProducts(productsString) {
  if (!productsString || typeof productsString !== 'string') {
    return [];
  }

  const products = [];
  // Split by comma to get individual products, but be careful of commas in event values
  // Products are separated by commas at the top level
  const productEntries = productsString.split(',');

  for (const entry of productEntries) {
    if (!entry.trim()) continue;

    // Split by semicolon to get fields: Category;Product;Quantity;Price;events;eVars
    const parts = entry.split(';');

    const product = {
      category: parts[0] || '',
      product: parts[1] || '',
      quantity: parts[2] ? parseInt(parts[2], 10) : null,
      price: parts[3] ? parseFloat(parts[3]) : null
    };

    // Parse product-scoped events (field 5) - format: event1=value|event2=value
    if (parts[4]) {
      const events = {};
      const eventParts = parts[4].split('|');
      for (const eventPart of eventParts) {
        const [eventName, eventValue] = eventPart.split('=');
        if (eventName) {
          events[eventName] = eventValue !== undefined ? parseFloat(eventValue) : true;
        }
      }
      if (Object.keys(events).length > 0) {
        product.events = events;
      }
    }

    // Parse merchandising eVars (field 6) - format: eVar1=value|eVar2=value
    if (parts[5]) {
      const merchEVars = {};
      const evarParts = parts[5].split('|');
      for (const evarPart of evarParts) {
        const [evarName, evarValue] = evarPart.split('=');
        if (evarName && evarValue !== undefined) {
          merchEVars[evarName] = evarValue;
        }
      }
      if (Object.keys(merchEVars).length > 0) {
        product.merchandisingEVars = merchEVars;
      }
    }

    products.push(product);
  }

  return products;
}

/**
 * Extract and categorize Adobe Analytics parameters
 * - eVars (v1-v255): Conversion variables
 * - props (c1-c75): Traffic variables (sProps)
 * - hierarchies (h1-h5): Hierarchy variables
 * - events: Custom events with optional values
 * @param {Object} params - URL query parameters
 * @returns {Object} Categorized Adobe Analytics data
 */
export function extractAdobeAnalyticsData(params) {
  const eVars = {};
  const props = {};
  const hierarchies = {};
  const events = {};
  const identifiers = {};
  const context = {};

  for (const [key, value] of Object.entries(params)) {
    // eVars: v1, v2, ... v255 (but not 'v' alone which is Java enabled)
    if (/^v\d+$/.test(key)) {
      const num = key.substring(1);
      eVars[`eVar${num}`] = value;
    }
    // Props: c1, c2, ... c75 (but not 'c' alone which is color depth, or 'cc' which is currency)
    else if (/^c\d+$/.test(key)) {
      const num = key.substring(1);
      props[`prop${num}`] = value;
    }
    // Hierarchies: h1, h2, ... h5
    else if (/^h\d$/.test(key)) {
      const num = key.substring(1);
      hierarchies[`hier${num}`] = value;
    }
    // Identifiers
    else if (key === 'mid') {
      identifiers['Marketing Cloud ID (mid)'] = value;
    }
    else if (key === 'aid') {
      identifiers['Analytics ID (aid)'] = value;
    }
    else if (key === 'mcorgid') {
      identifiers['Org ID (mcorgid)'] = value;
    }
    else if (key === 'sdid') {
      identifiers['Supplemental Data ID (sdid)'] = value;
    }
    // Context
    else if (key === 'pageName' || key === 'pn') {
      context['Page Name (pageName)'] = value;
    }
    else if (key === 'g') {
      context['Page URL (g)'] = value;
    }
    else if (key === 'r') {
      context['Referrer (r)'] = value;
    }
    else if (key === 'cc') {
      context['Currency (cc)'] = value;
    }
    else if (key === 'ch') {
      context['Channel (ch)'] = value;
    }
    else if (key === 'server') {
      context['Server (server)'] = value;
    }
  }

  // Parse events string (e.g., "event510=0.13,event511=0.00,event523")
  if (params.events) {
    const eventParts = params.events.split(',');
    for (const part of eventParts) {
      const [eventName, eventValue] = part.split('=');
      if (eventValue !== undefined) {
        events[eventName] = parseFloat(eventValue);
      } else {
        events[eventName] = true; // Event fired without value
      }
    }
  }

  return { eVars, props, hierarchies, events, identifiers, context };
}

/**
 * Parse an Adobe Analytics request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body data (URL-encoded form data)
 * @returns {Object} Parsed Adobe Analytics data
 */
export function parseAdobeAnalyticsRequestData(url, postData = null) {
  const urlObj = new URL(url);
  // Start with URL query params
  const params = Object.fromEntries(urlObj.searchParams);

  // Merge POST body params if present (Adobe Analytics sends data as URL-encoded POST body)
  if (postData && typeof postData === 'string') {
    try {
      const postParams = new URLSearchParams(postData);
      for (const [key, value] of postParams) {
        params[key] = value;
      }
    } catch (e) {
      // If parsing fails, skip POST data
    }
  }

  // Extract report suite from path (e.g., /b/ss/reportSuiteId/...)
  let reportSuite = null;
  let eventName = 'Page View';

  const pathMatch = urlObj.pathname.match(/\/b\/ss\/([^\/]+)/);
  if (pathMatch) {
    reportSuite = pathMatch[1];
  }

  // Try to extract from first-party path (e.g., /company-global/company-dk/2/i.gif)
  if (!reportSuite && urlObj.pathname.includes('/i.gif')) {
    const pathParts = urlObj.pathname.split('/').filter(p => p && p !== 'i.gif');
    if (pathParts.length > 0) {
      reportSuite = pathParts.join('/');
    }
  }

  // Common Adobe Analytics params
  const pageName = params.pageName || params.pn;
  const eventsStr = params.events || params.ev;
  const products = params.products || params.pl;
  const campaign = params.v0 || params.campaign;

  // Link tracking params
  const linkType = params.pe;  // lnk_o (custom), lnk_d (download), lnk_e (exit)
  const linkName = params.pev2; // Link name
  const linkUrl = params.pev1;  // Link URL

  // Extract eVars, props, and hierarchy variables
  const adobeData = extractAdobeAnalyticsData(params);

  // Determine event name based on hit type
  // Adobe Analytics hit types: Page View (no pe), Link Tracking (pe=lnk_*)
  if (linkType) {
    // Link tracking call
    const linkTypeLabel = linkType === 'lnk_o' ? 'Custom Link' :
                          linkType === 'lnk_d' ? 'Download' :
                          linkType === 'lnk_e' ? 'Exit Link' : 'Link';
    if (linkName && linkName !== 'no link_name') {
      eventName = `${linkTypeLabel}: ${linkName}`;
    } else {
      eventName = linkTypeLabel;
    }
  } else if (pageName) {
    // Page view with page name
    eventName = `Page View: ${pageName}`;
  } else {
    // Default page view
    eventName = 'Page View';
  }

  // Build overview
  const overview = {};
  if (reportSuite) overview['Report Suite'] = reportSuite;
  if (pageName) overview['Page Name'] = pageName;
  if (campaign) overview['Campaign'] = campaign;

  // Build sections for structured display (standard layout)
  const sections = [];

  // 2. Custom Data — business variables grouped by type
  const customData = {};
  if (Object.keys(adobeData.eVars).length > 0) {
    customData['eVars (Conversion Variables)'] = adobeData.eVars;
  }
  if (Object.keys(adobeData.props).length > 0) {
    customData['Props (Traffic Variables)'] = adobeData.props;
  }
  if (Object.keys(adobeData.events).length > 0) {
    customData['Events'] = adobeData.events;
  }
  if (Object.keys(adobeData.hierarchies).length > 0) {
    customData['Hierarchies'] = adobeData.hierarchies;
  }
  if (Object.keys(customData).length > 0) {
    sections.push({ title: 'Custom Data', data: customData, type: 'table' });
  }

  // 3. Products — parse and add if present
  if (products) {
    const parsedProducts = parseAdobeProducts(products);
    if (parsedProducts.length > 0) {
      sections.push({
        title: `Products (${parsedProducts.length})`,
        data: parsedProducts,
        type: 'products-table',
        rawValue: products
      });
    }
  }

  // 4. Parsed Data — system/protocol data as grouped params
  const groupedParams = {};

  if (adobeData.context && Object.keys(adobeData.context).length > 0) {
    groupedParams['Page Context'] = adobeData.context;
  }

  // Link Tracking group — only for link tracking hits
  if (linkType) {
    const linkData = {};
    const linkTypeLabel = linkType === 'lnk_o' ? 'Custom Link' :
                          linkType === 'lnk_d' ? 'Download' :
                          linkType === 'lnk_e' ? 'Exit Link' : linkType;
    linkData['Link Type (pe)'] = linkTypeLabel;
    if (linkName) linkData['Link Name (pev2)'] = linkName;
    if (linkUrl) linkData['Link URL (pev1)'] = linkUrl;
    groupedParams['Link Tracking'] = linkData;
  }

  if (adobeData.identifiers && Object.keys(adobeData.identifiers).length > 0) {
    groupedParams['Identifiers'] = adobeData.identifiers;
  }

  return {
    eventName,
    overview,
    params: groupedParams,
    parsedDisplayMode: 'table',
    sections,
    rawParams: params
  };
}
