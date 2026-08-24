import type { Parameter, ParameterType } from "../../core/types";
import { formatMoney, prettyJson, truncateMiddle } from "../../core/url";
import { InfoTip } from "./Tooltip";
import { CopyButton } from "./CopyButton";

interface Props {
  title: string;
  params: Parameter[];
}

export function ParamSection({ title, params }: Props) {
  if (params.length === 0) return null;
  return (
    <section className="detail-section">
      <h3 className="section-title">{title}</h3>
      <div className="param-list">
        {params.map((p) => (
          <ParamRow key={p.key} param={p} />
        ))}
      </div>
    </section>
  );
}

function ParamRow({ param }: { param: Parameter }) {
  const isComplex = typeof param.value === "object" && param.value !== null;
  return (
    <div className="param-row">
      <div className="param-label">
        <span className="param-name" title={param.key}>
          {param.label}
        </span>
        {param.type && <TypeBadge type={param.type} />}
        {param.key !== param.label && <span className="param-key">{param.key}</span>}
        {(param.description || param.documentationUrl) && (
          <InfoTip
            title={param.label}
            description={param.description}
            docUrl={param.documentationUrl}
          />
        )}
      </div>
      {isComplex ? (
        <div className="param-value param-value-complex">
          <pre className="code-block">{prettyJson(param.value)}</pre>
          <CopyButton
            getText={() => prettyJson(param.value)}
            label="Copy value"
          />
        </div>
      ) : (
        <div className="param-value">
          <ValueText param={param} />
          <CopyButton
            getText={() => String(param.value ?? "")}
            label="Copy value"
          />
        </div>
      )}
    </div>
  );
}

function ValueText({ param }: { param: Parameter }) {
  const { value, type } = param;
  if (value === undefined || value === null || value === "") {
    return <span className="value-empty">—</span>;
  }
  if (type === "currency" && typeof value === "number") {
    return <span className="value-mono">{formatMoney(value)}</span>;
  }
  if (type === "url" && typeof value === "string") {
    return (
      <a className="value-link" href={value} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        {truncateMiddle(value, 60)}
      </a>
    );
  }
  if (typeof value === "boolean") {
    return <span className={`value-bool ${value ? "true" : "false"}`}>{String(value)}</span>;
  }
  const isMono = isMonoType(type) || (typeof value === "string" && /^[A-Za-z0-9_-]{6,}$/.test(value));
  return <span className={isMono ? "value-mono" : "value-text"}>{String(value)}</span>;
}

function isMonoType(type?: ParameterType): boolean {
  return type === "id" || type === "timestamp" || type === "number";
}

/** Compact type chip — only for types that carry real meaning. Plain
 * strings stay unbadged to keep the rows quiet. */
const BADGED_TYPES = new Set<ParameterType>([
  "id",
  "currency",
  "json",
  "timestamp",
  "boolean",
]);

function TypeBadge({ type }: { type: ParameterType }) {
  if (!BADGED_TYPES.has(type)) return null;
  return <span className={`type-badge type-${type}`}>{type}</span>;
}