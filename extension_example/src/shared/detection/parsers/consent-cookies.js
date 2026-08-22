// Consent Cookie Parsers
// Reads and parses consent cookies from 25 CMPs into unified consent categories.
// Used by the consent timeline to determine consent state for returning visitors
// and after consent banner interactions.
//
// Unified categories: analytics, marketing, functional
// Values: 'granted' | 'denied'

// =============================================================================
// Individual CMP cookie parsers
// Each returns { analytics, marketing, functional } or null
// =============================================================================

/**
 * Parse Cookiebot CookieConsent cookie (URL-encoded object with boolean categories)
 * Two known formats:
 *   JSON: {"stamp":"...","necessary":true,"statistics":false,"marketing":false,...}
 *   JS literal: {stamp:'...',necessary:true,statistics:false,marketing:false,...}
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseCookiebotCookie(value) {
  try {
    const decoded = decodeURIComponent(value);
    // Try JSON first, then fall back to extracting booleans from JS object literal
    let stats, mkt, prefs;
    try {
      const parsed = JSON.parse(decoded);
      stats = parsed.statistics;
      mkt = parsed.marketing;
      prefs = parsed.preferences;
    } catch {
      // JS object literal format: keys unquoted, strings in single quotes
      const getBool = (key) => {
        const m = decoded.match(new RegExp(key + '\\s*:(true|false)'));
        return m ? m[1] === 'true' : undefined;
      };
      stats = getBool('statistics');
      mkt = getBool('marketing');
      prefs = getBool('preferences');
    }
    if (stats === undefined && mkt === undefined && prefs === undefined) return null;
    return {
      analytics: stats ? 'granted' : 'denied',
      marketing: mkt ? 'granted' : 'denied',
      functional: prefs ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse OneTrust OptanonConsent cookie (URL-encoded params with groups field)
 * Format: groups=C0001:1,C0002:1,C0003:0,C0004:0&...
 * Groups: C0001=Necessary, C0002=Performance/Analytics, C0003=Functional, C0004=Targeting/Marketing
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseOneTrustCookie(value) {
  try {
    const params = new URLSearchParams(value);
    const groups = params.get('groups');
    if (!groups) return null;
    // Only parse standard C-series group IDs — return null for custom IDs (e.g. CNN's dsh/dsl/req)
    if (!groups.includes('C000')) return null;
    const groupMap = {};
    groups.split(',').forEach(g => {
      const [id, val] = g.split(':');
      groupMap[id] = val === '1';
    });
    // Only include categories whose group IDs are configured on this site.
    // The cookie lists ALL groups (even denied ones as :0), so absent = not configured.
    const result = {};
    if ('C0002' in groupMap) result.analytics = groupMap['C0002'] ? 'granted' : 'denied';
    if ('C0004' in groupMap) result.marketing = groupMap['C0004'] ? 'granted' : 'denied';
    if ('C0003' in groupMap) result.functional = groupMap['C0003'] ? 'granted' : 'denied';
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Parse Didomi didomi_token cookie (Base64-encoded JSON with purposes)
 * Format: base64({ purposes: { consent: { enabled: [...], disabled: [...] } } })
 * Purpose IDs vary by site, but common ones: analytics, advertising, personalization
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseDidomiCookie(value) {
  try {
    const json = JSON.parse(atob(value));
    const consent = json?.purposes?.consent;
    if (!consent) return null;
    const enabled = new Set(consent.enabled || []);
    const disabled = new Set(consent.disabled || []);
    const allPurposes = [...enabled, ...disabled];

    // Didomi purpose IDs are site-specific — only include categories we can confidently map
    function hasPurpose(keywords) {
      for (const id of allPurposes) {
        const lower = id.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          return enabled.has(id) ? 'granted' : 'denied';
        }
      }
      return undefined;
    }

    const result = {};
    let hasUnmapped = false;
    const a = hasPurpose(['analytics', 'measure', 'statistic', 'performance']);
    const m = hasPurpose(['advertis', 'marketing', 'ad_', 'target']);
    const f = hasPurpose(['functional', 'preference']);
    if (a !== undefined) result.analytics = a; else hasUnmapped = true;
    if (m !== undefined) result.marketing = m; else hasUnmapped = true;
    if (f !== undefined) result.functional = f; else hasUnmapped = true;
    if (Object.keys(result).length === 0) return null;
    if (hasUnmapped) result._hasUnmappedCategories = true;
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse Osano osano_consentmanager cookie (JSON with category states)
 * Format: {"ANALYTICS":"ACCEPT","MARKETING":"DENY","PERSONALIZATION":"ACCEPT",...}
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseOsanoCookie(value) {
  try {
    const parsed = JSON.parse(value);
    function mapState(key) {
      const val = parsed[key];
      return val === 'ACCEPT' ? 'granted' : 'denied';
    }
    return {
      analytics: mapState('ANALYTICS'),
      marketing: mapState('MARKETING'),
      functional: mapState('PERSONALIZATION'),
    };
  } catch {
    return null;
  }
}

/**
 * Parse iubenda _iub_cs-* cookie (JSON with purposes object)
 * Format: {"timestamp":"...","purposes":{"1":true,"2":false,"3":true,"4":true,"5":false},...}
 * Purpose IDs: 1=Necessary, 2=Functionality, 3=Experience, 4=Measurement, 5=Marketing
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseIubendaCookie(value) {
  try {
    const parsed = JSON.parse(value);
    const p = parsed.purposes || {};
    return {
      analytics: p['4'] ? 'granted' : 'denied',
      marketing: p['5'] ? 'granted' : 'denied',
      functional: p['2'] ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse CookieYes cookieyes-consent cookie (key-value pairs separated by commas)
 * Format: consentid:xxx,consent:yes,action:yes,analytics:yes,functional:no,performance:no,advertisement:no
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseCookieYesCookie(value) {
  try {
    const pairs = {};
    value.split(',').forEach(part => {
      const [k, v] = part.split(':');
      if (k && v) pairs[k.trim()] = v.trim();
    });
    return {
      analytics: pairs.analytics === 'yes' || pairs.performance === 'yes' ? 'granted' : 'denied',
      marketing: pairs.advertisement === 'yes' ? 'granted' : 'denied',
      functional: pairs.functional === 'yes' ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse IAB TCF euconsent-v2 cookie (TCF v2.2 consent string — Base64 bitfield)
 * We extract purpose-level consent for 11 standard TCF purposes.
 * Simplified parser: decodes the consent string to check purpose consent bits.
 * @param {string} value - Cookie value (Base64url-encoded TCF consent string)
 * @returns {Object|null} Unified consent categories
 */
function parseTCFCookie(value) {
  try {
    // TCF consent strings use Base64url encoding with padding variations
    // Decode to binary string
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    // TCF v2 binary format (bit positions):
    // 0-5: Version (6 bits)
    // 6-41: Created (36 bits)
    // 42-77: LastUpdated (36 bits)
    // 78-89: CmpId (12 bits)
    // 90-101: CmpVersion (12 bits)
    // 102-107: ConsentScreen (6 bits)
    // 108-119: ConsentLanguage (12 bits)
    // 120-131: VendorListVersion (12 bits)
    // 132-137: TcfPolicyVersion (6 bits)
    // 138: IsServiceSpecific (1 bit)
    // 139: UseNonStandardTexts (1 bit) — v2.2 only
    // 140-151: SpecialFeatureOptIns (12 bits)
    // 152-175: PurposesConsent (24 bits — purposes 1-24)

    function getBit(bitIndex) {
      const byteIndex = Math.floor(bitIndex / 8);
      const bitPos = 7 - (bitIndex % 8);
      if (byteIndex >= bytes.length) return false;
      return (bytes[byteIndex] & (1 << bitPos)) !== 0;
    }

    // Purpose consent starts at bit 152, 24 bits for purposes 1-24
    // We only need purposes 1-11
    const purposes = {};
    for (let i = 1; i <= 11; i++) {
      purposes[i] = getBit(152 + i - 1);
    }

    // Map TCF purposes to unified categories:
    // Purpose 1: Store/access info — Necessary (always implied)
    // Purpose 7: Measure ad perf, Purpose 8: Measure content perf — Analytics
    // Purposes 2-6: Various advertising purposes — Marketing
    // Purpose 3: Personalised ads, Purpose 4: Personalised content — Personalization
    return {
      analytics: (purposes[7] || purposes[8]) ? 'granted' : 'denied',
      marketing: (purposes[2] || purposes[3] || purposes[4] || purposes[5] || purposes[6]) ? 'granted' : 'denied',
      functional: purposes[1] ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse CookieScript CookieScriptConsent cookie (JSON with action + categories array)
 * Format: {"action":"accept","categories":["strict","performance","targeting","functionality"]}
 * Categories: strict (necessary), performance (analytics), targeting (marketing), functionality
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseCookieScriptCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    const cats = new Set(parsed.categories || []);
    return {
      analytics: cats.has('performance') ? 'granted' : 'denied',
      marketing: cats.has('targeting') ? 'granted' : 'denied',
      functional: cats.has('functionality') ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse CookieFirst cookiefirst-consent cookie (JSON with boolean categories)
 * Format: {"necessary":true,"performance":true,"functional":false,"advertising":false}
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseCookieFirstCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return {
      analytics: parsed.performance ? 'granted' : 'denied',
      marketing: parsed.advertising ? 'granted' : 'denied',
      functional: parsed.functional ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse TrustArc cmapi_cookie_privacy cookie (comma-separated category numbers)
 * Format: "1,2,3" — presence of a number means that category is consented
 * Standard categories: 1=Required, 2=Functional, 3=Advertising/Targeting
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseTrustArcCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const cats = new Set(value.split(',').map(s => s.trim()));
    // TrustArc only has 3 categories — Category 2 (Functional) covers both analytics and preferences
    return {
      analytics: cats.has('2') ? 'granted' : 'denied',
      marketing: cats.has('3') ? 'granted' : 'denied',
      functional: cats.has('2') ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Piwik PRO ppms_privacy_* cookie (JSON with consents object)
 * Format: {"consents":{"analytics":{"status":1},"remarketing":{"status":-1},...}}
 * Status: 1=granted, 0=not set, -1=denied
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parsePiwikProCookie(value) {
  try {
    const parsed = JSON.parse(value);
    const c = parsed.consents;
    if (!c) return null;
    const isGranted = key => c[key]?.status === 1;
    // Piwik PRO has no separate functional/preferences category — analytics consent covers it
    return {
      analytics: isGranted('analytics') ? 'granted' : 'denied',
      marketing: (isGranted('remarketing') || isGranted('conversion_tracking') || isGranted('marketing_automation')) ? 'granted' : 'denied',
      functional: isGranted('analytics') ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Complianz consent from multiple cmplz_* cookies
 * Cookie names: cmplz_marketing, cmplz_statistics, cmplz_preferences, cmplz_statistics-anonymous
 * Values: 'allow' or 'deny'
 * @param {Object} cookieMap - Map of { cookieName: value } for all cmplz_* cookies
 * @returns {Object|null} Unified consent categories
 */
function parseComplianzCookies(cookieMap) {
  if (!cookieMap || Object.keys(cookieMap).length === 0) return null;
  return {
    analytics: cookieMap['cmplz_statistics'] === 'allow' || cookieMap['cmplz_statistics-anonymous'] === 'allow' ? 'granted' : 'denied',
    marketing: cookieMap['cmplz_marketing'] === 'allow' ? 'granted' : 'denied',
    functional: cookieMap['cmplz_preferences'] === 'allow' ? 'granted' : 'denied',
  };
}

/**
 * Parse Consentmo cookies (two cookies read together).
 * - cookieconsent_status: 'allow' | 'deny' | 'dismiss' | 'non_gdpr' — which button was pressed
 * - cookieconsent_preferences_disabled: URL-encoded comma-separated list of disabled categories
 *   (e.g. 'analytics,marketing'). Consentmo's categories: necessary, functionality, analytics, marketing.
 * Behavior:
 *   - non_gdpr → all granted (visitor is outside GDPR/LGPD region)
 *   - deny → all non-necessary categories denied
 *   - allow / dismiss / no status → use disabled list: listed categories denied, others granted
 * @param {Object} cookieMap - { status?: string, disabled?: string }
 * @returns {Object|null} Unified consent categories
 */
function parseConsentmoCookies(cookieMap) {
  if (!cookieMap || (cookieMap.status === undefined && cookieMap.disabled === undefined)) {
    return null;
  }
  try {
    const status = cookieMap.status;

    // Visitor outside GDPR/LGPD region — Consentmo treats this as full consent.
    if (status === 'non_gdpr') {
      return { analytics: 'granted', marketing: 'granted', functional: 'granted' };
    }

    // Visitor declined the banner — every non-necessary category is denied.
    if (status === 'deny') {
      return { analytics: 'denied', marketing: 'denied', functional: 'denied' };
    }

    // Parse the disabled list (URL-encoded, comma-separated).
    const rawDisabled = cookieMap.disabled || '';
    let decoded = rawDisabled;
    try { decoded = decodeURIComponent(rawDisabled); } catch { /* use raw */ }
    const disabled = new Set(
      decoded.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    );

    // Need at least one signal to produce a result.
    if (status === undefined && disabled.size === 0) return null;

    return {
      analytics: disabled.has('analytics') ? 'denied' : 'granted',
      marketing: disabled.has('marketing') ? 'denied' : 'granted',
      functional: (disabled.has('functionality') || disabled.has('functional')) ? 'denied' : 'granted',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Ethyca Fides fides_consent cookie (JSON with consent preferences)
 * Format varies: boolean {"marketing":true} or mechanism {"marketing":"opt-in"}
 * Notice IDs are configurable; common patterns are matched to categories.
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseFidesCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    // Filter out Fides metadata keys (fides_* prefixed)
    const consentKeys = Object.keys(parsed).filter(k => !k.startsWith('fides_'));
    if (consentKeys.length === 0) return null;

    function isGranted(key) {
      const val = parsed[key];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val === 'opt-in' || val === 'true';
      return false;
    }

    // Fides notice IDs are configurable — only include categories we can confidently map
    function findPurpose(keywords) {
      for (const key of consentKeys) {
        const lower = key.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          return isGranted(key) ? 'granted' : 'denied';
        }
      }
      return undefined;
    }

    const result = {};
    let hasUnmapped = false;
    const a = findPurpose(['analytics', 'measure', 'statistic', 'performance']);
    const m = findPurpose(['marketing', 'advertis', 'data_sales', 'target']);
    const f = findPurpose(['functional', 'essential']);
    if (a !== undefined) result.analytics = a; else hasUnmapped = true;
    if (m !== undefined) result.marketing = m; else hasUnmapped = true;
    if (f !== undefined) result.functional = f; else hasUnmapped = true;
    if (Object.keys(result).length === 0) return null;
    if (hasUnmapped) result._hasUnmappedCategories = true;
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse Ketch _ketch_consent_v1_* cookie (JSON with purposes object)
 * Format: {"purposes":{"analytics":true,"advertising":false,...}}
 * Purpose codes are org-configurable; common patterns are matched.
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseKetchCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    const purposes = parsed.purposes;
    if (!purposes || typeof purposes !== 'object') return null;

    function findPurpose(keywords) {
      for (const [key, val] of Object.entries(purposes)) {
        const lower = key.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          return val ? 'granted' : 'denied';
        }
      }
      return undefined;
    }

    const result = {};
    let hasUnmapped = false;
    const a = findPurpose(['analytics', 'measure', 'statistic', 'performance']);
    const m = findPurpose(['advertis', 'marketing', 'data_sales', 'target']);
    const f = findPurpose(['functional', 'essential']);
    if (a !== undefined) result.analytics = a; else hasUnmapped = true;
    if (m !== undefined) result.marketing = m; else hasUnmapped = true;
    if (f !== undefined) result.functional = f; else hasUnmapped = true;
    if (Object.keys(result).length === 0) return null;
    if (hasUnmapped) result._hasUnmappedCategories = true;
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse Borlabs Cookie borlabs-cookie cookie (JSON with consent groups)
 * Format: {"consents":{"essential":[...],"statistics":[...],"marketing":[],...}}
 * Non-empty array means consent granted for that group.
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseBorlabsCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    const consents = parsed.consents;
    if (!consents || typeof consents !== 'object') return null;

    function hasConsent(key) {
      const val = consents[key];
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'boolean') return val;
      return false;
    }

    return {
      analytics: hasConsent('statistics') ? 'granted' : 'denied',
      marketing: hasConsent('marketing') ? 'granted' : 'denied',
      functional: (hasConsent('external-media') || hasConsent('preferences')) ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Axeptio axeptio_cookies cookie (JSON with vendor-slug booleans)
 * Format: {"$$date":"...","$$completed":true,"google_analytics":true,"facebook_pixel":false,...}
 * Vendor slugs are site-specific; common patterns are matched to categories.
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseAxeptioCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    // Filter out Axeptio metadata keys ($$-prefixed)
    const vendorKeys = Object.keys(parsed).filter(k => !k.startsWith('$$'));
    if (vendorKeys.length === 0) return null;

    function findConsent(keywords) {
      for (const key of vendorKeys) {
        const lower = key.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          return parsed[key] ? 'granted' : 'denied';
        }
      }
      return undefined;
    }

    const result = {};
    let hasUnmapped = false;
    const a = findConsent(['analytics', 'statistic', 'measure', 'performance', 'matomo', 'google_analytics', 'hotjar']);
    const m = findConsent(['marketing', 'advertis', 'facebook', 'meta_pixel', 'google_ads', 'tiktok', 'target']);
    const f = findConsent(['functional', 'preference', 'personali']);
    if (a !== undefined) result.analytics = a; else hasUnmapped = true;
    if (m !== undefined) result.marketing = m; else hasUnmapped = true;
    if (f !== undefined) result.functional = f; else hasUnmapped = true;
    if (Object.keys(result).length === 0) return null;
    if (hasUnmapped) result._hasUnmappedCategories = true;
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse Cookie Information CookieInformationConsent cookie (JSON with consents_approved array)
 * Format: {"consents_approved":["cookie_cat_necessary","cookie_cat_statistic","cookie_cat_marketing"],...}
 * Categories: cookie_cat_necessary, cookie_cat_functional, cookie_cat_statistic, cookie_cat_marketing
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseCookieInformationCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    const approved = new Set(parsed.consents_approved || []);
    return {
      analytics: approved.has('cookie_cat_statistic') ? 'granted' : 'denied',
      marketing: approved.has('cookie_cat_marketing') ? 'granted' : 'denied',
      functional: approved.has('cookie_cat_functional') ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Digital Control Room wscrCookieConsent cookie (ampersand-delimited key-value pairs)
 * Format: "1=true&2=false&3=true&4=false&5=false&version=20260304-001&consent=explicit"
 * Default levels: 1=Security (always on), 2=Functionality, 3=Analytics, 4=Advertising, 5=Additional
 * Note: Levels are site-configurable — not all sites use Level 2 (Functionality).
 * We only map levels we can confidently identify: 3→analytics, 4→marketing.
 * Functional is left null since Level 2 is not universally used.
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseDCRCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const params = new URLSearchParams(value);
    return {
      analytics: params.get('3') === 'true' ? 'granted' : 'denied',
      marketing: params.get('4') === 'true' ? 'granted' : 'denied',
      functional: null, // Level 2 is site-configurable — cannot reliably map
    };
  } catch {
    return null;
  }
}

/**
 * Parse TrustArc notice_gdpr_prefs cookie (colon-delimited category numbers)
 * Fallback for cmapi_cookie_privacy. Format: "0:1:2" where numbers indicate consented categories.
 * Categories: 0=base, 1=Required, 2=Functional/Analytics, 3=Advertising
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseTrustArcGdprPrefsCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split(':').map(s => s.trim());
    const cats = new Set(parts);
    // TrustArc only has 3 categories — Category 2 (Functional) covers both analytics and preferences
    return {
      analytics: cats.has('2') ? 'granted' : 'denied',
      marketing: cats.has('3') ? 'granted' : 'denied',
      functional: cats.has('2') ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Termly T_DC_* cookie (JSON with consent categories)
 * Format: {"1":"granted","2":"granted","3":"denied","4":"denied","5":"denied"}
 * Category IDs: 1=Essential, 2=Performance/Analytics, 3=Analytics, 4=Advertising, 5=Social Media
 * Also checks termly_gtm_template_default_consented (same format).
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseTermlyCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (typeof parsed !== 'object' || parsed === null) return null;

    // Check if a category is granted — handles both string ('granted') and boolean (true) formats
    function isGranted(val) {
      return val === 'granted' || val === true;
    }

    // Termly has two analytics categories: 2/performance and 3/analytics
    // Grant analytics if either is granted
    const perf = isGranted(parsed['2']) || isGranted(parsed['performance']);
    const analytics = isGranted(parsed['3']) || isGranted(parsed['analytics']);
    return {
      analytics: (perf || analytics) ? 'granted' : 'denied',
      marketing: (isGranted(parsed['4']) || isGranted(parsed['advertising'])) ? 'granted' : 'denied',
      functional: (isGranted(parsed['5']) || isGranted(parsed['social_networking']) || isGranted(parsed['1']) || isGranted(parsed['essential'])) ? 'granted' : 'denied',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Transcend tcm cookie (JSON with consent purposes)
 * Format: {"confirmed":true,"purposes":{"Analytics":true,"Advertising":false,"Functional":true},"timestamp":"..."}
 * Purpose names are capitalized. Values are booleans.
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseTranscendCookie(value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    const purposes = parsed?.purposes;
    if (!purposes || typeof purposes !== 'object') return null;

    function findPurpose(keywords) {
      for (const [key, val] of Object.entries(purposes)) {
        const lower = key.toLowerCase();
        if (keywords.some(k => lower.includes(k))) {
          // Handle both boolean (true/false) and string ('opt-in'/'opt-out') formats
          if (typeof val === 'boolean') return val ? 'granted' : 'denied';
          return val === 'opt-in' ? 'granted' : 'denied';
        }
      }
      return undefined;
    }

    const result = {};
    let hasUnmapped = false;
    const a = findPurpose(['analytics', 'measure', 'statistic', 'performance']);
    const m = findPurpose(['advertis', 'marketing', 'target']);
    const f = findPurpose(['functional', 'essential']);
    if (a !== undefined) result.analytics = a; else hasUnmapped = true;
    if (m !== undefined) result.marketing = m; else hasUnmapped = true;
    if (f !== undefined) result.functional = f; else hasUnmapped = true;
    if (Object.keys(result).length === 0) return null;
    if (hasUnmapped) result._hasUnmappedCategories = true;
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse Pandectes _pandectes_gdpr cookie (Base64-encoded JSON with bitmask preferences)
 * Decoded format: {"id":"...","preferences":N,"status":"allow|deny|custom","timestamp":...,"version":...,"country":{"code":"..","state":".."}}
 * preferences is a 3-bit integer (0–7) where each bit = 1 means consent REJECTED:
 *   Bit 0 (1): Functionality rejected
 *   Bit 1 (2): Performance/Analytics rejected
 *   Bit 2 (4): Targeting/Marketing rejected
 * @param {string} value - Cookie value (Base64-encoded)
 * @returns {Object|null} Unified consent categories
 */
function parsePandectesCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const decoded = atob(value);
    const parsed = JSON.parse(decoded);
    const prefs = parsed.preferences;
    if (typeof prefs !== 'number') return null;
    return {
      analytics: (prefs & 2) ? 'denied' : 'granted',
      marketing: (prefs & 4) ? 'denied' : 'granted',
      functional: (prefs & 1) ? 'denied' : 'granted',
    };
  } catch {
    return null;
  }
}

/**
 * Parse Evidon/Crownpeak _evidon_consent_cookie (JSON with category consent per country)
 * Format: {"consent_date":"...","categories":{"3":{"category name":true,...}},"vendors":{},"cookies":{},"consent_type":1}
 * Category names are site-configurable — uses keyword matching against known consent patterns.
 * @param {string} value - Cookie value (JSON or URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseEvidonCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = JSON.parse(decodeURIComponent(value)); }
    if (!parsed || typeof parsed !== 'object') return null;
    const categories = parsed.categories;
    if (!categories || typeof categories !== 'object') return null;
    // Flatten all country-level category objects into a single map
    const allCats = {};
    for (const countryId of Object.keys(categories)) {
      const countryCats = categories[countryId];
      if (countryCats && typeof countryCats === 'object') {
        for (const [name, allowed] of Object.entries(countryCats)) {
          allCats[name.toLowerCase()] = !!allowed;
        }
      }
    }
    if (Object.keys(allCats).length === 0) return null;
    // Keyword-match category names to unified categories
    const keywords = {
      analytics: ['analytics', 'statistic', 'performance', 'measurement'],
      marketing: ['marketing', 'advertis', 'targeting', 'advertising'],
      functional: ['functional', 'preference', 'essential', 'necessary'],
    };
    const result = {};
    for (const [unified, terms] of Object.entries(keywords)) {
      for (const [catName, allowed] of Object.entries(allCats)) {
        if (terms.some(t => catName.includes(t))) {
          result[unified] = allowed ? 'granted' : 'denied';
          break;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Parse Secure Privacy sp_dpr cookie (JSON, possibly base64-encoded)
 * Format: {"answered":true,"allAllowed":true/false,"categories":[...],...}
 * When allAllowed is true, all categories are granted.
 * When false, categories array contains allowed/denied category info.
 * @param {string} value - Cookie value (JSON or base64-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseSecurePrivacyCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    let parsed;
    try { parsed = JSON.parse(value); } catch {
      try { parsed = JSON.parse(decodeURIComponent(value)); } catch {
        try { parsed = JSON.parse(atob(value)); } catch { return null; }
      }
    }
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.answered) return null;
    if (parsed.allAllowed === true) {
      return { analytics: 'granted', marketing: 'granted', functional: 'granted' };
    }
    if (parsed.allAllowed === false && (!parsed.categories || parsed.categories.length === 0)) {
      return { analytics: 'denied', marketing: 'denied', functional: 'denied' };
    }
    // Parse categories array — format varies, try keyword matching on category names
    if (Array.isArray(parsed.categories)) {
      const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
      for (const cat of parsed.categories) {
        const name = (typeof cat === 'string' ? cat : (cat?.name || cat?.label || '')).toLowerCase();
        if (!name) continue;
        const allowed = typeof cat === 'string' ? true : (cat?.allowed !== false && cat?.consent !== false);
        if (['analytics', 'statistic', 'performance', 'measurement'].some(t => name.includes(t))) {
          result.analytics = allowed ? 'granted' : 'denied';
        } else if (['marketing', 'advertis', 'targeting'].some(t => name.includes(t))) {
          result.marketing = allowed ? 'granted' : 'denied';
        } else if (['functional', 'preference', 'essential', 'necessary'].some(t => name.includes(t))) {
          result.functional = allowed ? 'granted' : 'denied';
        }
      }
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse Tarteaucitron cookie (exclamation-delimited key=value pairs per service)
 * Format: "googleanalytics=true!gtag=false!hotjar=wait"
 * Service types: analytic, ads, social, video, api, etc. — site-configurable
 * Uses keyword matching on service keys to map to unified categories.
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseTarteaucitronCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const decoded = decodeURIComponent(value);
    const pairs = decoded.split('!').filter(Boolean);
    if (pairs.length === 0) return null;
    const keywords = {
      analytics: ['analytics', 'statistic', 'measure', 'performance', 'gtag', 'ga', 'matomo', 'piwik', 'plausible', 'amplitude'],
      marketing: ['ads', 'advertis', 'marketing', 'facebook', 'pixel', 'tiktok', 'linkedin', 'remarketing', 'adwords'],
      functional: ['functional', 'preference', 'youtube', 'vimeo', 'maps', 'recaptcha', 'chat'],
    };
    const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
    let matched = false;
    for (const pair of pairs) {
      const [key, val] = pair.split('=');
      if (!key || val === 'wait') continue;
      const granted = val === 'true';
      const lower = key.toLowerCase();
      for (const [unified, terms] of Object.entries(keywords)) {
        if (terms.some(t => lower.includes(t))) {
          if (granted) result[unified] = 'granted';
          matched = true;
          break;
        }
      }
    }
    return matched ? result : null;
  } catch {
    return null;
  }
}

/**
 * Parse Civic Cookie Control CookieControl cookie (JSON with optionalCookies consent states)
 * Format: {"optionalCookies":{"analytics":"accepted","marketing":"revoked"},...}
 * Category names are site-configurable — uses keyword matching.
 * @param {string} value - Cookie value (JSON or URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseCivicCookieControlCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = JSON.parse(decodeURIComponent(value)); }
    if (!parsed || typeof parsed !== 'object') return null;
    const optional = parsed.optionalCookies;
    if (!optional || typeof optional !== 'object') return null;
    const keywords = {
      analytics: ['analytics', 'statistic', 'performance', 'measurement'],
      marketing: ['marketing', 'advertis', 'targeting', 'advertising'],
      functional: ['functional', 'preference', 'essential', 'necessary'],
    };
    const result = {};
    for (const [catName, status] of Object.entries(optional)) {
      const lower = catName.toLowerCase();
      const accepted = status === 'accepted' || status === true || status === 1 || status === '1';
      for (const [unified, terms] of Object.entries(keywords)) {
        if (terms.some(t => lower.includes(t))) {
          result[unified] = accepted ? 'granted' : 'denied';
          break;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Parse Klaro consent cookie (URL-encoded JSON with per-service boolean consent)
 * Format: {"google-analytics":true,"facebook-pixel":false,"youtube":true}
 * Service names are site-configurable — uses keyword matching.
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseKlaroCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = JSON.parse(decodeURIComponent(value)); }
    if (!parsed || typeof parsed !== 'object') return null;
    const keywords = {
      analytics: ['analytics', 'statistic', 'measure', 'performance', 'google-analytics', 'matomo', 'piwik', 'plausible'],
      marketing: ['ads', 'advertis', 'marketing', 'facebook', 'pixel', 'tiktok', 'linkedin', 'remarketing'],
      functional: ['functional', 'preference', 'youtube', 'vimeo', 'maps', 'recaptcha', 'chat'],
    };
    const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
    let matched = false;
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val !== 'boolean') continue;
      const lower = key.toLowerCase();
      for (const [unified, terms] of Object.entries(keywords)) {
        if (terms.some(t => lower.includes(t))) {
          if (val) result[unified] = 'granted';
          matched = true;
          break;
        }
      }
    }
    return matched ? result : null;
  } catch {
    return null;
  }
}

/**
 * Parse Commanders Act TC_PRIVACY cookie (@-delimited fields)
 * Format: <status>@<version>@<bannerId>@<siteId>@<consentCategories>@<blockedCategories>@<timestamps>
 * Status: 0=optin (all accepted), 1=optout (custom/rejected)
 * Categories field (index 4): URL-encoded comma-separated category IDs that are consented
 * Category IDs are numeric and site-configurable — uses keyword matching if names are embedded,
 * otherwise falls back to status field for binary consent.
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseCommandersActCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const fields = value.split('@');
    if (fields.length < 5) return null;
    const status = fields[0];
    // Status 0 = all consented (optin), Status 1 = optout/custom
    if (status === '0') {
      return { analytics: 'granted', marketing: 'granted', functional: 'granted' };
    }
    if (status === '1') {
      // Custom selection — categories in field 4 are the consented ones
      const consentedRaw = decodeURIComponent(fields[4] || '');
      const blockedRaw = decodeURIComponent(fields[5] || '');
      if (!consentedRaw && !blockedRaw) {
        return { analytics: 'denied', marketing: 'denied', functional: 'denied' };
      }
      // Category IDs are numeric and site-specific — we can only report binary consent
      // If there are consented categories but also blocked ones, it's mixed
      const consented = consentedRaw.split(',').filter(Boolean);
      const blocked = blockedRaw.split(',').filter(Boolean);
      if (blocked.length === 0 && consented.length > 0) {
        return { analytics: 'granted', marketing: 'granted', functional: 'granted' };
      }
      if (consented.length === 0) {
        return { analytics: 'denied', marketing: 'denied', functional: 'denied' };
      }
      // Mixed consent — can't map numeric IDs to unified categories without site config
      // Return null to let other sources (window API, push data) provide category-level detail
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse Moove GDPR moove_gdpr_popup cookie (URL-encoded JSON with category toggles)
 * Format (decoded): {"strict":"1","thirdparty":"0","advanced":"0","performance":"1","preference":"0"}
 * Categories: thirdparty → analytics, advanced → marketing, preference → functional
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseMooveGdprCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const decoded = decodeURIComponent(value);
    const data = JSON.parse(decoded);
    if (!data || typeof data !== 'object') return null;
    return {
      analytics: (data.thirdparty === '1' || data.performance === '1') ? 'granted' : 'denied',
      marketing: data.advanced === '1' ? 'granted' : 'denied',
      functional: data.preference === '1' ? 'granted' : 'denied'
    };
  } catch {
    return null;
  }
}

/**
 * Parse Cookie Notice cookie_notice_accepted cookie (plain string boolean)
 * Format: "true" or "false" — binary accept/reject, no per-category granularity
 * @param {string} value - Cookie value
 * @returns {Object|null} Unified consent categories
 */
function parseCookieNoticeCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const accepted = value.trim().toLowerCase() === 'true';
    const state = accepted ? 'granted' : 'denied';
    return { analytics: state, marketing: state, functional: state };
  } catch {
    return null;
  }
}

/**
 * Parse WPLP Cookie Consent wpl_user_preference cookie (JSON with category toggles)
 * Format: {"necessary":"yes","marketing":"yes","analytics":"no","preferences":"yes","unclassified":"no"}
 * @param {string} value - Cookie value (JSON string)
 * @returns {Object|null} Unified consent categories
 */
function parseWplpCookieConsent(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const data = JSON.parse(value);
    if (!data || typeof data !== 'object') return null;
    return {
      analytics: data.analytics === 'yes' ? 'granted' : 'denied',
      marketing: data.marketing === 'yes' ? 'granted' : 'denied',
      functional: data.preferences === 'yes' ? 'granted' : 'denied'
    };
  } catch {
    return null;
  }
}

/**
 * Parse WebToffee GDPR CookieLawInfoConsent cookie (URL-encoded JSON with boolean categories)
 * Format (decoded): {"necessary":true,"functional":false,"analytics":false,"performance":false,"advertisement":false}
 * Categories: analytics → analytics, advertisement → marketing, functional → functional
 * @param {string} value - Cookie value (URL-encoded JSON)
 * @returns {Object|null} Unified consent categories
 */
function parseWebToffeeCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    const decoded = decodeURIComponent(value);
    const data = JSON.parse(decoded);
    if (!data || typeof data !== 'object') return null;
    return {
      analytics: (data.analytics === true || data.performance === true) ? 'granted' : 'denied',
      marketing: data.advertisement === true ? 'granted' : 'denied',
      functional: data.functional === true ? 'granted' : 'denied'
    };
  } catch {
    return null;
  }
}

/**
 * Parse CCM19 ccm_consent cookie (JSON with purposes object mapping hex IDs to names)
 * Format: {"consent":true,"ucid":"...","timestamp":1608208345,"purposes":{"41ba25c":"Technically necessary","abc123":"Statistics"},"embeddings":{...},"manipulationPrevention":true}
 * Purpose names are site-configurable — use keyword matching on name values
 * @param {string} value - Cookie value (JSON string, possibly URL-encoded)
 * @returns {Object|null} Unified consent categories
 */
function parseCCM19Cookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    let decoded = value;
    // Try URL-decoding first if it looks encoded
    if (value.includes('%')) {
      try { decoded = decodeURIComponent(value); } catch { /* use raw */ }
    }
    const data = JSON.parse(decoded);
    if (!data || typeof data !== 'object') return null;
    if (data.consent === false) {
      return { analytics: 'denied', marketing: 'denied', functional: 'denied' };
    }
    const purposes = data.purposes;
    if (!purposes || typeof purposes !== 'object') return null;

    // Purpose names are site-configurable — keyword-match on the human-readable names
    const purposeNames = Object.values(purposes).map(n => (typeof n === 'string' ? n : '').toLowerCase());

    function hasPurpose(keywords) {
      for (const name of purposeNames) {
        if (keywords.some(k => name.includes(k))) return 'granted';
      }
      return 'denied';
    }

    const result = {};
    result.analytics = hasPurpose(['statistic', 'analytics', 'analyse', 'statistik', 'measure', 'performance']);
    result.marketing = hasPurpose(['marketing', 'advertis', 'werbung', 'target']);
    result.functional = hasPurpose(['functional', 'funktional', 'preference', 'komfort']);

    // If all denied and we have purposes, it means we just couldn't match keywords —
    // the user might have accepted purposes with non-standard names
    if (result.analytics === 'denied' && result.marketing === 'denied' && result.functional === 'denied' && purposeNames.length > 1) {
      result._hasUnmappedCategories = true;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Parse CookieHub `cookiehub` cookie (base64-encoded JSON consent record).
 * Decoded shape:
 *   { "answered":true, "revision":3, "allAllowed":true, "allowSale":true,
 *     "categories":[], "vendors":[], "services":[], ... }
 * The `categories` array is empty when everything is allowed (allAllowed:true);
 * on a partial choice it carries per-category objects ({ category, value }).
 * CookieHub's standard categories are necessary, preferences, analytics,
 * marketing, uncategorized.
 * @param {string} value - Cookie value (base64, possibly URL-encoded)
 * @returns {Object|null} Unified consent categories
 */
function parseCookieHubCookie(value) {
  try {
    if (!value || typeof value !== 'string') return null;
    let raw = value;
    if (raw.includes('%')) {
      try { raw = decodeURIComponent(raw); } catch { /* use raw */ }
    }
    const json = JSON.parse(atob(raw));
    if (!json || typeof json !== 'object') return null;
    // No decision recorded yet — don't assert a consent state.
    if (json.answered === false) return null;

    // "Accept all" collapses to allAllowed:true with an empty categories array.
    if (json.allAllowed === true) {
      return { analytics: 'granted', marketing: 'granted', functional: 'granted' };
    }

    // Partial choice — categories[] carries per-category decisions. Normalise to
    // a { <categoryName>: <granted-boolean> } map (key is category/id/name).
    const catState = {};
    if (Array.isArray(json.categories)) {
      for (const entry of json.categories) {
        if (entry && typeof entry === 'object') {
          const name = (entry.category || entry.id || entry.name || '').toString().toLowerCase();
          const granted = entry.value === true || entry.value === 'true' || entry.allowed === true;
          if (name) catState[name] = granted;
        } else if (typeof entry === 'string') {
          // Bare-string form: a listed category is an allowed one.
          catState[entry.toLowerCase()] = true;
        }
      }
    }
    // A recorded answer with no per-category data and allAllowed falsy means
    // nothing beyond necessary was granted — report all denied (conservative).
    const lookup = (name) => (catState[name] ? 'granted' : 'denied');
    return {
      analytics: lookup('analytics'),
      marketing: lookup('marketing'),
      functional: lookup('preferences'),
    };
  } catch {
    return null;
  }
}

// =============================================================================
// Cookie reading and discovery
// =============================================================================

/** Map of known consent cookie names to their CMP and parser */
const CONSENT_COOKIE_MAP = {
  'CookieConsent': { cmp: 'Cookiebot', parser: parseCookiebotCookie },
  'OptanonConsent': { cmp: 'OneTrust', parser: parseOneTrustCookie },
  'didomi_token': { cmp: 'Didomi', parser: parseDidomiCookie },
  'osano_consentmanager': { cmp: 'Osano', parser: parseOsanoCookie },
  'cookieyes-consent': { cmp: 'CookieYes', parser: parseCookieYesCookie },
  'cookiehub': { cmp: 'CookieHub', parser: parseCookieHubCookie },
  'euconsent-v2': { cmp: 'IAB TCF', parser: parseTCFCookie },
  'CookieScriptConsent': { cmp: 'CookieScript', parser: parseCookieScriptCookie },
  'cookiefirst-consent': { cmp: 'CookieFirst', parser: parseCookieFirstCookie },
  'cmapi_cookie_privacy': { cmp: 'TrustArc', parser: parseTrustArcCookie },
  'notice_gdpr_prefs': { cmp: 'TrustArc', parser: parseTrustArcGdprPrefsCookie },
  'fides_consent': { cmp: 'Ethyca Fides', parser: parseFidesCookie },
  'borlabs-cookie': { cmp: 'Borlabs Cookie', parser: parseBorlabsCookie },
  'axeptio_cookies': { cmp: 'Axeptio', parser: parseAxeptioCookie },
  'CookieInformationConsent': { cmp: 'Cookie Information', parser: parseCookieInformationCookie },
  '_pandectes_gdpr': { cmp: 'Pandectes', parser: parsePandectesCookie },
  'tcm': { cmp: 'Transcend', parser: parseTranscendCookie },
  '_evidon_consent_cookie': { cmp: 'Evidon', parser: parseEvidonCookie },
  'sp_dpr': { cmp: 'Secure Privacy', parser: parseSecurePrivacyCookie },
  'tarteaucitron': { cmp: 'Tarteaucitron', parser: parseTarteaucitronCookie },
  'CookieControl': { cmp: 'Civic Cookie Control', parser: parseCivicCookieControlCookie },
  'klaro': { cmp: 'Klaro', parser: parseKlaroCookie },
  'TC_PRIVACY': { cmp: 'Commanders Act CMP', parser: parseCommandersActCookie },
  'moove_gdpr_popup': { cmp: 'Moove GDPR', parser: parseMooveGdprCookie },
  'cookie_notice_accepted': { cmp: 'Cookie Notice', parser: parseCookieNoticeCookie },
  'wpl_user_preference': { cmp: 'WPLP Cookie Consent', parser: parseWplpCookieConsent },
  'CookieLawInfoConsent': { cmp: 'WebToffee GDPR', parser: parseWebToffeeCookie },
  'ccm_consent': { cmp: 'CCM19', parser: parseCCM19Cookie },
};

/**
 * Read all consent cookies for a given page URL and parse them.
 * Uses chrome.cookies.getAll() which includes HttpOnly cookies.
 * @param {string} tabUrl - Full URL of the inspected page
 * @returns {Promise<Object>} { [cmpName]: { analytics, marketing, functional } }
 */
export async function readConsentCookies(tabUrl, storeId) {
  if (!tabUrl) return {};

  try {
    // Include storeId when provided so incognito tabs read from the correct cookie store.
    // Without storeId, spanning-mode service workers default to the normal profile store.
    const query = { url: tabUrl };
    if (storeId) query.storeId = storeId;
    const cookies = await chrome.cookies.getAll(query);

    // Also fetch partitioned cookies (CHIPS, Chrome 119+) — consent cookies
    // may be set with the Partitioned attribute on sites using cross-site iframes.
    try {
      const origin = new URL(tabUrl).origin;
      const partQuery = { url: tabUrl, partitionKey: { topLevelSite: origin } };
      if (storeId) partQuery.storeId = storeId;
      const partitioned = await chrome.cookies.getAll(partQuery);
      // Add partitioned cookies that aren't already in the main list
      const existingNames = new Set(cookies.map(c => c.name));
      for (const cookie of partitioned) {
        if (!existingNames.has(cookie.name)) {
          cookies.push(cookie);
        }
      }
    } catch {
      // partitionKey not supported (Chrome < 119) — silently continue
    }
    const result = {};

    // Collect Complianz individual cookies (cmplz_*) for multi-cookie parsing
    const complianzCookies = {};

    // Collect Consentmo's two cookies (cookieconsent_status + cookieconsent_preferences_disabled)
    // for multi-cookie parsing — neither cookie alone gives complete per-category state.
    const consentmoCookies = {};

    for (const cookie of cookies) {
      // Check exact-match cookie names
      const match = CONSENT_COOKIE_MAP[cookie.name];
      if (match) {
        const parsed = match.parser(cookie.value);
        if (parsed) {
          result[match.cmp] = parsed;
        }
      }
      // Digital Control Room uses wscrCookieConsent or wscrCookieConsentShared
      if (cookie.name.startsWith('wscrCookieConsent') && !result['Digital Control Room']) {
        const parsed = parseDCRCookie(cookie.value);
        if (parsed) {
          result['Digital Control Room'] = parsed;
        }
      }
      // iubenda uses prefix pattern: _iub_cs-*
      if (cookie.name.startsWith('_iub_cs-') && !result['iubenda']) {
        const parsed = parseIubendaCookie(cookie.value);
        if (parsed) {
          result['iubenda'] = parsed;
        }
      }
      // Piwik PRO uses prefix pattern: ppms_privacy_*
      if (cookie.name.startsWith('ppms_privacy_') && !result['Piwik Pro Consent']) {
        const parsed = parsePiwikProCookie(cookie.value);
        if (parsed) {
          result['Piwik Pro Consent'] = parsed;
        }
      }
      // Ketch uses prefix pattern: _ketch_consent_v1_*
      if (cookie.name.startsWith('_ketch_consent_v1_') && !result['Ketch']) {
        const parsed = parseKetchCookie(cookie.value);
        if (parsed) {
          result['Ketch'] = parsed;
        }
      }
      // Termly uses prefix pattern: T_DC_* (e.g., T_DC_12345)
      if (cookie.name.startsWith('T_DC_') && !result['Termly']) {
        const parsed = parseTermlyCookie(cookie.value);
        if (parsed) {
          result['Termly'] = parsed;
        }
      }
      // Complianz uses individual cookies per category: cmplz_*
      if (cookie.name.startsWith('cmplz_')) {
        complianzCookies[cookie.name] = cookie.value;
      }
      // Consentmo's per-category state is split across two cookies
      if (cookie.name === 'cookieconsent_status') {
        consentmoCookies.status = cookie.value;
      }
      if (cookie.name === 'cookieconsent_preferences_disabled') {
        consentmoCookies.disabled = cookie.value;
      }
    }

    // Parse Complianz multi-cookie consent
    if (Object.keys(complianzCookies).length > 0 && !result['Complianz']) {
      const parsed = parseComplianzCookies(complianzCookies);
      if (parsed) {
        result['Complianz'] = parsed;
      }
    }

    // Parse Consentmo multi-cookie consent
    if (Object.keys(consentmoCookies).length > 0 && !result['Consentmo']) {
      const parsed = parseConsentmoCookies(consentmoCookies);
      if (parsed) {
        result['Consentmo'] = parsed;
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Get the list of known consent cookie names (for detection purposes)
 * @returns {string[]} Array of cookie name patterns
 */
export function getConsentCookieNames() {
  return [
    ...Object.keys(CONSENT_COOKIE_MAP),
    '_iub_cs-*', 'ppms_privacy_*', '_ketch_consent_v1_*', 'cmplz_*', 'T_DC_*', 'wscrCookieConsent*',
    'cookieconsent_status', 'cookieconsent_preferences_disabled',
  ];
}
