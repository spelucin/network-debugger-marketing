import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  docUrl?: string;
}

/**
 * Hover/focus affordance that reveals a parameter's local definition.
 * Rendered in a portal so it is never clipped by scroll containers.
 */
export function InfoTip({ title, description, docUrl }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, below: true });

  const position = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const below = spaceBelow >= 140 || spaceBelow >= spaceAbove;
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - 290));
    setPos({ top: below ? r.bottom + 6 : r.top - 6, left, below });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="info-tip"
        aria-label={`About ${title}`}
        title=""
        onMouseEnter={() => {
          position();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          position();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          if (open) {
            setOpen(false);
          } else {
            position();
            setOpen(true);
          }
        }}
      >
        <Info size={12} strokeWidth={2} />
      </button>
      {open &&
        createPortal(
          <div
            className={`tooltip ${pos.below ? "tooltip-below" : "tooltip-above"}`}
            style={{ top: pos.top, left: pos.left }}
            role="tooltip"
          >
            <div className="tooltip-title">{title}</div>
            {description && <div className="tooltip-desc">{description}</div>}
            {docUrl && (
              <a
                className="tooltip-link"
                href={docUrl}
                target="_blank"
                rel="noreferrer"
              >
                Documentation ↗
              </a>
            )}
          </div>,
          document.body
        )}
    </>
  );
}