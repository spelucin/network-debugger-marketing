interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

/** Accessible toggle switch — pure CSS, no library. */
export function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}
