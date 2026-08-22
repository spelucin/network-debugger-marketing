import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function copyText(text: string): void {
  void navigator.clipboard.writeText(text).catch(() => {
    // Fallback for environments without clipboard access.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  });
}

/** Copy button with a transient "copied" state. */
export function CopyButton({ getText, label, className }: { getText: () => string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`copy-btn ${className ?? ""}`}
      title={label}
      aria-label={label}
      onClick={() => {
        copyText(getText());
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}