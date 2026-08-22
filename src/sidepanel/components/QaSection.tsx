import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { QAIssue } from "../../core/types";

export function QaSection({ issues }: { issues: QAIssue[] }) {
  if (issues.length === 0) {
    return (
      <section className="detail-section">
        <h3 className="section-title">QA</h3>
        <div className="qa-clean">
          <CheckCircle2 size={14} />
          No issues detected.
        </div>
      </section>
    );
  }

  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  return (
    <section className="detail-section">
      <h3 className="section-title">QA</h3>
      <div className="qa-list">
        {warnings.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
        {infos.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </div>
    </section>
  );
}

function IssueRow({ issue }: { issue: QAIssue }) {
  const Icon = issue.severity === "warning" ? AlertTriangle : Info;
  return (
    <div className={`qa-item qa-${issue.severity}`}>
      <span className="qa-icon">
        <Icon size={14} />
      </span>
      <div className="qa-body">
        <div className="qa-message">{issue.message}</div>
        {issue.detail && <div className="qa-detail">{issue.detail}</div>}
      </div>
    </div>
  );
}