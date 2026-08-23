import type { MatcherPerf } from "../../core/types";

interface Props {
  perf: MatcherPerf;
}

/** Thin throughput line under the request list, fed by the observation plane. */
export function StatsFooter({ perf }: Props) {
  if (perf.observed === 0) return null;
  return (
    <footer className="stats-footer" aria-label="Capture throughput">
      {perf.observed.toLocaleString()} observed · {perf.matched.toLocaleString()}{" "}
      matched
      {perf.avgMs > 0 && <> · {perf.avgMs} ms avg classify</>}
    </footer>
  );
}
