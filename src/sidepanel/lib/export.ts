import type { MarketingRequest } from "../../core/types";
import { formatTimeShort } from "../../core/url";
import { bareName } from "../../definitions";
import { requestId } from "./filters";

export interface ExportRow {
  timestamp: number;
  time: string;
  platform: string;
  event: string;
  id: string;
  transaction_id: string;
  value: string;
  currency: string;
  url: string;
}

function paramValue(request: MarketingRequest, name: string): string {
  const decoded = request.decoded;
  if (!decoded) return "";
  for (const p of [
    ...decoded.standardParameters,
    ...decoded.customParameters,
  ]) {
    if (bareName(decoded.platform, p.key) === name) {
      return p.value === undefined || p.value === null ? "" : String(p.value);
    }
  }
  if (decoded.ecommerce) {
    const e = decoded.ecommerce;
    if (name === "transaction_id" && e.transaction_id) return e.transaction_id;
    if (name === "value" && e.value !== undefined) return String(e.value);
    if (name === "currency" && e.currency) return e.currency;
  }
  return "";
}

export function toExportRows(requests: MarketingRequest[]): ExportRow[] {
  return [...requests]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({
      timestamp: r.timestamp,
      time: formatTimeShort(r.timestamp),
      platform: r.platform,
      event: r.eventName ?? "",
      id: requestId(r),
      transaction_id: paramValue(r, "transaction_id"),
      value: paramValue(r, "value"),
      currency: paramValue(r, "currency"),
      url: r.url,
    }));
}

/** Normalized JSON export: decoded meaning, not just raw URLs. */
export function buildJsonExport(requests: MarketingRequest[]): string {
  const payload = requests.map((r) => {
    const decoded = r.decoded;
    const parameters: Record<string, unknown> = {};
    const context: Record<string, unknown> = {};
    const custom: Record<string, unknown> = {};
    for (const p of decoded?.standardParameters ?? []) parameters[p.key] = p.value;
    for (const p of decoded?.contextParameters ?? []) context[p.key] = p.value;
    for (const p of decoded?.customParameters ?? []) custom[p.key] = p.value;
    return {
      platform: r.platform,
      event: r.eventName,
      timestamp: r.timestamp,
      time: formatTimeShort(r.timestamp),
      measurement_id:
        typeof decoded?.meta.measurementId === "string"
          ? decoded.meta.measurementId
          : undefined,
      pixel_id:
        typeof decoded?.meta.pixelId === "string" ? decoded.meta.pixelId : undefined,
      conversion_id:
        typeof decoded?.meta.conversionId === "string"
          ? decoded.meta.conversionId
          : undefined,
      parameters,
      custom_parameters: custom,
      context,
      ecommerce: decoded?.ecommerce,
      url: r.url,
    };
  });
  return JSON.stringify(payload, null, 2);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvExport(requests: MarketingRequest[]): string {
  const rows = toExportRows(requests);
  const header = [
    "timestamp",
    "time",
    "platform",
    "event",
    "id",
    "transaction_id",
    "value",
    "currency",
    "url",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.timestamp,
        row.time,
        csvEscape(row.platform),
        csvEscape(row.event),
        csvEscape(row.id),
        csvEscape(row.transaction_id),
        row.value,
        csvEscape(row.currency),
        csvEscape(row.url),
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function downloadFile(
  filename: string,
  content: string,
  mime = "application/json"
): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}