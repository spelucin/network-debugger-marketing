import type {
  DecodedEvent,
  ParamCategory,
  Parameter,
  ParameterType,
  Platform,
  RawRequest,
} from "../core/types";
import { getDefinition } from "../definitions";
import { prettyValue } from "../core/url";

export interface MarketingParser {
  id: string;
  platform: Platform;
  canParse(request: RawRequest): boolean;
  parse(request: RawRequest): DecodedEvent;
}

/**
 * Build a normalized Parameter for a raw transport key, enriching it with the
 * local definition (label, description, doc link, type) when available.
 */
export function makeParam(
  platform: Platform,
  key: string,
  value: unknown,
  category: ParamCategory,
  fallbackType?: ParameterType
): Parameter {
  const def = getDefinition(platform, key);
  return {
    key,
    label: def?.label ?? key,
    value,
    category: def?.category ?? category,
    description: def?.description,
    documentationUrl: def?.documentationUrl,
    type: def?.type ?? fallbackType ?? guessType(value),
  };
}

function guessType(value: unknown): ParameterType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "json";
  return "string";
}

/** Render a value for display/export in a stable way. */
export function valueText(value: unknown): string {
  return prettyValue(value);
}