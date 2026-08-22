/**
 * Color Utility Functions
 * Single source of truth for color calculations used across the extension
 */

/**
 * Convert hex color to RGB components
 * @param {string} hex - Hex color (e.g., '#ff0000' or 'ff0000')
 * @returns {{r: number, g: number, b: number}}
 */
export function hexToRgb(hex) {
  let cleanHex = hex.replace('#', '');
  // Expand 3-char shorthand (e.g. 'f0c' → 'ff00cc')
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  return {
    r: parseInt(cleanHex.substr(0, 2), 16),
    g: parseInt(cleanHex.substr(2, 2), 16),
    b: parseInt(cleanHex.substr(4, 2), 16)
  };
}

/**
 * Calculate relative luminance using WCAG formula
 * @param {string} hex - Hex color
 * @returns {number} Luminance value 0-1
 */
export function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Check if a color is light (needs dark text for contrast)
 * @param {string} hex - Hex color
 * @returns {boolean}
 */
export function isLightColor(hex) {
  return getLuminance(hex) > 0.6;
}

/**
 * Generate CSS rgba() string for backgrounds
 * @param {string} hex - Brand color
 * @param {number} opacity - 0-1 (default 0.15)
 * @returns {string}
 */
export function hexToRgba(hex, opacity = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get appropriate text color for count badges based on background brightness
 * @param {string} brandColor - Brand hex color
 * @returns {string} White for dark backgrounds, dark slate for light backgrounds
 */
export function getBadgeTextColor(brandColor) {
  return isLightColor(brandColor) ? '#1e293b' : '#ffffff';
}

/**
 * Darken a hex color by a percentage
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
export function darkenColor(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - (percent / 100);
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Check if a color is grey/neutral (low saturation)
 * @param {string} hex - Hex color
 * @returns {boolean}
 */
export function isGreyColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation < 0.2; // Low saturation = grey/neutral
}

/**
 * Get appropriate text color for event badges
 * For grey/neutral colors, returns a darker shade for better contrast
 * @param {string} brandColor - Brand hex color
 * @param {string} [textColorOverride] - Optional explicit override
 * @returns {string} Text color hex
 */
export function getEventBadgeTextColor(brandColor, textColorOverride) {
  if (textColorOverride) return textColorOverride;

  // For grey/neutral colors, darken significantly for contrast
  if (isGreyColor(brandColor)) {
    return darkenColor(brandColor, 40);
  }

  // For other colors, use the brand color as text
  return brandColor;
}
