// Google Consent Mode (CCM) Parsing Utilities
// Parses /ccm/collect and routes to correct platform based on tracking ID

import { extractGA4EventParams, extractGA4UserProperties } from './ga4.js';

/**
 * Determine the platform and parse data from a Google CCM request
 * CCM is a DELIVERY METHOD, not a platform - routes to correct platform based on tracking ID
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed CCM data with platform routing information
 */
export function parseGoogleCCMData(url, postData) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // CCM uses 'id', 'tid', or 'tids' params for the tracking/conversion ID
  const trackingId = params.id || params.tid || params.tids;

  // Check for Floodlight (DC-*) - route to Google Floodlight
  const dcMatch = trackingId?.match(/DC-(\d+)/);
  if (dcMatch) {
    const conversionId = `DC-${dcMatch[1]}`;
    const eventName = params.en || 'Conversion';
    const overview = {
      'Advertiser ID': conversionId,
      'Event': eventName,
      'Consent Mode': 'CCM'
    };
    if (params.dl || params.url) overview['Page URL'] = params.dl || params.url;

    return {
      routeTo: 'google-floodlight',
      platformName: 'Google Floodlight',
      eventName,
      overview,
      params,
      postData,
      detectedBy: 'URL matches /ccm/collect with DC-* tracking ID (Floodlight via Consent Mode)'
    };
  }

  // Check for Google Ads conversion (AW-*) - route to Google Ads Conversion
  const awMatch = trackingId?.match(/AW-(\d+)/);
  if (awMatch) {
    const conversionId = `AW-${awMatch[1]}`;
    const conversionLabel = params.l || params.label;
    const eventName = params.en || 'Conversion';
    const overview = {
      'Conversion ID': conversionId,
      'Event': eventName,
      'Consent Mode': 'CCM'
    };
    if (conversionLabel) overview['Conversion Label'] = conversionLabel;
    if (params.dl || params.url) overview['Page URL'] = params.dl || params.url;

    return {
      routeTo: 'google-ads-conversion',
      platformName: 'Google Ads Conversion',
      eventName,
      overview,
      params,
      postData,
      detectedBy: 'URL matches /ccm/collect with AW-* tracking ID (Google Ads via Consent Mode)'
    };
  }

  // Check for GA4 (G-*) - route to GA4
  const ga4Match = trackingId?.match(/G-[A-Z0-9]+/);
  if (ga4Match) {
    const measurementId = ga4Match[0];
    const eventName = params.en || 'page_view';
    const overview = {
      'Measurement ID': measurementId,
      'Event': eventName,
      'Consent Mode': 'CCM'
    };
    if (params.dl || params.url) overview['Page URL'] = params.dl || params.url;

    return {
      routeTo: 'ga4',
      platformName: 'GA4',
      eventName,
      overview,
      params: extractGA4EventParams(params),
      userProperties: extractGA4UserProperties(params),
      rawParams: params,
      postData,
      detectedBy: 'URL matches /ccm/collect with G-* tracking ID (GA4 via Consent Mode)'
    };
  }

  // Check for Conversion Linker - detected by click ID params
  const hasClickId = params.gclaw || params.gclid || params.gclsrc || params.wbraid || params.gbraid;
  if (hasClickId) {
    const eventName = params.en || 'page_view';
    const overview = {
      'Event': eventName
    };
    if (params.gclaw) overview['GCLAW (Click ID)'] = params.gclaw;
    if (params.gclid) overview['GCLID'] = params.gclid;
    if (params.wbraid) overview['WBRAID'] = params.wbraid;
    if (params.gbraid) overview['GBRAID'] = params.gbraid;
    if (params.gclsrc) overview['Click Source'] = params.gclsrc;
    if (params.dl || params.url) overview['Page URL'] = params.dl || params.url;
    if (params.gcd) overview['Consent Data'] = params.gcd;

    return {
      routeTo: 'google-conversion-linker',
      platformName: 'Google Conversion Linker',
      eventName,
      overview,
      params,
      postData,
      detectedBy: 'URL matches /ccm/collect with click ID parameters (gclaw/gclid/wbraid/gbraid) — Conversion Linker'
    };
  }

  // Fallback: Unknown tracking ID or pure consent ping - categorize as Consent Mode
  const detectedBy = urlObj.pathname.includes('/ccm/collect')
    ? 'URL matches Google Consent Mode pattern: /ccm/collect'
    : 'URL matches Google Consent Mode pattern: /ccm/form-data';

  const overview = { 'Consent Mode': 'Yes' };
  if (trackingId) overview['Tracking ID'] = trackingId;
  if (params.dl || params.url) overview['Page URL'] = params.dl || params.url;

  return {
    routeTo: 'google-ccm',
    platformName: 'Google Consent Mode',
    eventName: 'Consent Signal',
    overview,
    params,
    postData,
    detectedBy
  };
}
