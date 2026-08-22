// Twitter/X Pixel Parsing Utilities
// Extracts event data from analytics.twitter.com and t.co/i/adsct requests

/**
 * Parse a Twitter/X Pixel request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Twitter/X data
 */
export function parseTwitterPixelData(url, postData) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Merge POST body params if present (form-encoded)
  if (postData) {
    try {
      const bodyParams = new URLSearchParams(postData);
      for (const [k, v] of bodyParams) {
        if (!params[k]) params[k] = v;
      }
    } catch (e) {
      // Try JSON body
      try {
        const json = JSON.parse(postData);
        if (typeof json === 'object' && !Array.isArray(json)) {
          Object.assign(params, json);
        }
      } catch (e2) { /* ignore */ }
    }
  }

  const eventName = params.event || params.ev || 'PageView';
  const pixelId = params.txn_id;
  const partnerId = params.p_id;

  // Build overview
  const overview = {};
  if (pixelId) overview['Pixel ID'] = pixelId;
  if (partnerId) overview['Partner'] = partnerId;
  if (params.tw_sale_amount) overview['Sale Amount'] = params.tw_sale_amount;
  if (params.tw_order_quantity) overview['Quantity'] = params.tw_order_quantity;

  // --- Custom Data: conversion parameters (user-defined business data) ---
  const customData = {};
  const conversionFields = {};
  if (params.tw_sale_amount) conversionFields['Sale Amount (tw_sale_amount)'] = params.tw_sale_amount;
  if (params.tw_order_quantity) conversionFields['Order Quantity (tw_order_quantity)'] = params.tw_order_quantity;
  if (params.tw_order_id) conversionFields['Order ID (tw_order_id)'] = params.tw_order_id;
  if (params.tw_currency) conversionFields['Currency (tw_currency)'] = params.tw_currency;
  if (params.tw_value) conversionFields['Value (tw_value)'] = params.tw_value;
  if (params.tw_num_items) conversionFields['Number of Items (tw_num_items)'] = params.tw_num_items;
  if (params.tw_search_string) conversionFields['Search String (tw_search_string)'] = params.tw_search_string;
  if (params.tw_content_type) conversionFields['Content Type (tw_content_type)'] = params.tw_content_type;
  if (params.tw_content_id) conversionFields['Content ID (tw_content_id)'] = params.tw_content_id;
  if (params.tw_content_name) conversionFields['Content Name (tw_content_name)'] = params.tw_content_name;
  if (Object.keys(conversionFields).length > 0) {
    customData['Conversion Data'] = conversionFields;
  }

  // Parse contents array (e-commerce items) if present
  let ecommerceItems = null;
  if (params.contents) {
    try {
      const contents = typeof params.contents === 'string' ? JSON.parse(params.contents) : params.contents;
      if (Array.isArray(contents) && contents.length > 0) {
        ecommerceItems = contents;
      }
    } catch (e) { /* not valid JSON */ }
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Identity
  const identity = {};
  if (pixelId) identity['Pixel ID (txn_id)'] = pixelId;
  if (partnerId) identity['Partner ID (p_id)'] = partnerId;
  if (params.tw_user) identity['User (tw_user)'] = params.tw_user;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Page Context
  const pageContext = {};
  if (params.tw_document_href) pageContext['Page URL (tw_document_href)'] = params.tw_document_href;
  if (params.tw_iframe_status) pageContext['Iframe Status (tw_iframe_status)'] = params.tw_iframe_status;
  if (params.redirect) pageContext['Redirect URL (redirect)'] = params.redirect;
  if (params.tw_page_url) pageContext['Page URL (tw_page_url)'] = params.tw_page_url;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Request
  const requestData = {};
  if (params.tw_pixel_id) requestData['Pixel ID (tw_pixel_id)'] = params.tw_pixel_id;
  if (params.tw_conversion_id) requestData['Conversion ID (tw_conversion_id)'] = params.tw_conversion_id;
  if (params.tpx_cb) requestData['Callback (tpx_cb)'] = params.tpx_cb;
  if (params.tw_gclid) requestData['GCLID (tw_gclid)'] = params.tw_gclid;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  const detectedBy = url.includes('analytics.twitter.com')
    ? 'URL contains analytics.twitter.com'
    : url.includes('t.co/i/adsct')
      ? 'URL contains t.co/i/adsct'
      : 'URL matches Twitter/X pixel pattern';

  return {
    eventName,
    pixelId,
    overview,
    customData,
    ecommerceItems,
    groupedParams,
    params,
    detectedBy
  };
}
