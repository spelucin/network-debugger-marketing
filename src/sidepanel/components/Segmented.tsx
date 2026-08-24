import type { ReactNode } from "react";

interface Option<T extends string> {
  id: T;
  label: ReactNode;
  title?: string;
}

interface Props<T extends string> {
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Segmented control with a sliding thumb. The thumb is a single element
 * translated by button index — no per-button measurement, GPU-only motion.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: Props<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value)
  );

  return (
    <div
      className={`segmented ${className ?? ""}`}
      role="group"
      aria-label={ariaLabel}
      style={{ ["--n" as string]: options.length }}
    >
      <span
        aria-hidden="true"
        className="segmented-thumb"
        style={{ ["--i" as string]: activeIndex }}
      />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`seg-btn ${option.id === value ? "active" : ""}`}
          onClick={() => onChange(option.id)}
          aria-pressed={option.id === value}
          title={option.title}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
