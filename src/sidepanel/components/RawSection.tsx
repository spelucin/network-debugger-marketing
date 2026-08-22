import type { MarketingRequest } from "../../core/types";
import { prettyJson, truncateMiddle } from "../../core/url";
import { CopyButton } from "./CopyButton";

export function RawSection({ request }: { request: MarketingRequest }) {
  const headers = request.headers;
  const headerEntries = headers ? Object.entries(headers) : [];

  const copyRequest = () => {
    const lines = [`${request.method} ${request.url}`];
    if (headers) {
      for (const [k, v] of Object.entries(headers)) lines.push(`${k}: ${v}`);
    }
    if (request.bodyText) lines.push("", request.bodyText);
    return lines.join("\n");
  };

  return (
    <div className="raw-view">
      <div className="raw-toolbar">
        <div className="raw-method" title={request.method}>
          {request.method}
        </div>
        <div className="raw-url" title={request.url}>
          {truncateMiddle(request.url, 90)}
        </div>
        <CopyButton getText={copyRequest} label="Copy request" />
      </div>

      <Section label="URL">
        <div className="raw-line url-full" title={request.url}>
          {request.url}
        </div>
      </Section>

      {Object.keys(request.queryParams).length > 0 && (
        <Section label={`Query parameters (${Object.keys(request.queryParams).length})`}>
          {Object.entries(request.queryParams).map(([key, value]) => (
            <div className="raw-kv" key={key}>
              <span className="raw-key">{key}</span>
              <span className="raw-val">
                {Array.isArray(value) ? value.join(", ") : String(value)}
              </span>
            </div>
          ))}
        </Section>
      )}

      {request.body !== undefined && (
        <Section label="Body">
          <pre className="code-block">{renderBody(request)}</pre>
          <CopyButton getText={() => String(request.bodyText ?? prettyJson(request.body))} label="Copy body" />
        </Section>
      )}

      {headerEntries.length > 0 && (
        <Section label={`Headers (${headerEntries.length})`}>
          {headerEntries.map(([key, value]) => (
            <div className="raw-kv" key={key}>
              <span className="raw-key">{key}</span>
              <span className="raw-val">{value}</span>
            </div>
          ))}
        </Section>
      )}

      <div className="raw-meta">
        Captured at {new Date(request.timestamp).toISOString()}
      </div>
    </div>
  );
}

function renderBody(request: MarketingRequest): string {
  if (typeof request.body === "object" && request.body !== null) {
    return prettyJson(request.body);
  }
  return request.bodyText ?? String(request.body ?? "");
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="raw-section">
      <div className="raw-section-label">{label}</div>
      <div className="raw-section-body">{children}</div>
    </div>
  );
}