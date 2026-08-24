import { useState } from "react";
import { ArrowLeft, FileSearch } from "lucide-react";
import type { MarketingRequest } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import { bareName } from "../../definitions";
import { compactUrl } from "../../core/url";
import { PlatformIcon, platformDotColor } from "./PlatformIcon";
import { ParamSection } from "./ParamSection";
import { EcommerceSection } from "./EcommerceSection";
import { RawSection } from "./RawSection";
import { CopyButton } from "./CopyButton";
import { Segmented } from "./Segmented";

interface Props {
  request: MarketingRequest;
  onBack: () => void;
}

export function Detail({ request, onBack }: Props) {
  const [mode, setMode] = useState<"decoded" | "raw">("decoded");
  const decoded = request.decoded;
  const info = PLATFORM_INFO[request.platform];

  const copyParams = () => {
    if (!decoded) return "";
    const lines: string[] = [];
    for (const p of [
      ...decoded.standardParameters,
      ...decoded.customParameters,
      ...decoded.contextParameters,
    ]) {
      lines.push(`${bareName(decoded.platform, p.key)}: ${formatValue(p.value)}`);
    }
    if (decoded.ecommerce?.items.length) {
      lines.push(`items: ${decoded.ecommerce.items.length}`);
    }
    return lines.join("\n");
  };

  return (
    <div className="detail">
      <div className="detail-header">
        <button
          type="button"
          className="icon-btn"
          onClick={onBack}
          title="Back to timeline"
          aria-label="Back to timeline"
        >
          <ArrowLeft size={15} />
        </button>
        <span className="detail-brand">
          <PlatformIcon platform={request.platform} size={18} />
        </span>
        <div className="detail-heading">
          <div className="detail-title">
            {decoded?.eventName ?? "Unknown request"}
          </div>
          <div className="detail-sub">{info.label}</div>
        </div>
      </div>

      <div className="detail-toolbar">
        <Segmented
          ariaLabel="View mode"
          value={mode}
          options={[
            { id: "decoded", label: "Decoded" },
            { id: "raw", label: "Raw" },
          ]}
          onChange={setMode}
        />
        {decoded && (
          <CopyButton getText={copyParams} label="Copy decoded parameters" className="toolbar-copy" />
        )}
      </div>

      <div className="detail-body">
        {mode === "raw" || !decoded ? (
          <RawSection request={request} />
        ) : (
          <DetailDecoded request={request} />
        )}
      </div>
    </div>
  );
}

function DetailDecoded({ request }: { request: MarketingRequest }) {
  const decoded = request.decoded!;
  const { meta } = decoded;
  const entityId =
    (typeof meta.measurementId === "string" && meta.measurementId) ||
    (typeof meta.conversionId === "string" && meta.conversionId) ||
    (typeof meta.pixelId === "string" && meta.pixelId) ||
    (typeof meta.projectId === "string" && meta.projectId);

  return (
    <div className="decoded-view">
      {request.unknown && (
        <div className="unknown-card">
          <FileSearch size={18} />
          <div>
            <div className="unknown-title">Unknown request</div>
            <div className="unknown-desc">
              We detected a network request but don&apos;t currently recognize its
              platform. Use the Raw view to inspect it.
            </div>
          </div>
          <span className="unknown-url">{compactUrl(request.url, 40)}</span>
        </div>
      )}

      {entityId && (
        <div className="entity-card">
          <span className="entity-dot" style={{ background: platformDotColor(request.platform) }} />
          <div className="entity-text">
            <div className="entity-label">
              {typeof meta.measurementId === "string"
                ? "Measurement ID"
                : typeof meta.conversionId === "string"
                  ? "Conversion ID"
                  : typeof meta.projectId === "string"
                    ? "Project ID"
                    : "Pixel ID"}
            </div>
            <div className="entity-id value-mono">{entityId}</div>
          </div>
        </div>
      )}

      <ParamSection title="Parameters" params={decoded.standardParameters} />
      {decoded.ecommerce && <EcommerceSection data={decoded.ecommerce} />}
      <ParamSection title="Context" params={decoded.contextParameters} />
      <ParamSection title="Custom parameters" params={decoded.customParameters} />
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}