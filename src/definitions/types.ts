import type { ParamCategory, ParameterType } from "../core/types";

/**
 * Local, structured description of a parameter. UI looks these up to render
 * human-readable labels, tooltips and documentation links — no AI involved.
 */
export interface ParameterDefinition {
  /** Bare parameter name used for lookup (e.g. "value", "transaction_id"). */
  name: string;
  label: string;
  description: string;
  category: ParamCategory;
  type?: ParameterType;
  documentationUrl?: string;
}

export function define(
  name: string,
  label: string,
  description: string,
  category: ParamCategory = "standard",
  options?: { type?: ParameterType; documentationUrl?: string }
): ParameterDefinition {
  return {
    name,
    label,
    description,
    category,
    type: options?.type,
    documentationUrl: options?.documentationUrl,
  };
}

export const GA4_DOCS = "https://developers.google.com/analytics/devguides/collection/ga4/events";
export const GOOGLE_ADS_DOCS = "https://support.google.com/google-ads/answer/6095821";
export const META_DOCS = "https://developers.facebook.com/docs/meta-pixel/reference";
export const TIKTOK_DOCS = "https://developers.tiktok.com/doc/events-api-getting-started";