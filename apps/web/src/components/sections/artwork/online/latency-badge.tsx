import type { ConnectionStatus } from "@/lib/realtime/contracts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@auction/ui";

function dotClassForRtt(rttMs: number | null, state: ConnectionStatus["state"]): string {
  if (state === "offline") return "bg-on-surface-variant";
  if (rttMs == null) return "bg-on-surface-variant";
  if (rttMs < 100) return "bg-success";
  if (rttMs < 300) return "bg-warning";
  return "bg-error";
}

function formatSampledAgo(lastSampleAt: number | null): string {
  if (lastSampleAt == null) return "—";
  const s = Math.max(0, Math.round((Date.now() - lastSampleAt) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

type Props = {
  status: ConnectionStatus;
  className?: string;
};

/** Presentational: connection dot + RTT label + tooltip breakdown. */
export function LatencyBadge({ status, className }: Props) {
  const { state, rttMs, lastSampleAt, lastBidPropagationMs } = status;

  if (state !== "offline" && rttMs === null) {
    return null;
  }

  const label = state === "offline" ? "Offline" : rttMs != null ? `${Math.round(rttMs)} ms` : "—";

  const propagationLine =
    lastBidPropagationMs != null
      ? `Last bid propagation: ${Math.round(lastBidPropagationMs)} ms`
      : "Last bid propagation: —";

  const tooltip = [
    rttMs != null ? `RTT (smoothed): ${Math.round(rttMs)} ms` : "RTT: —",
    propagationLine,
    `Connection: ${state}`,
    `Sampled: ${formatSampledAgo(lastSampleAt)}`,
  ].join("\n");

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <output
            aria-live="polite"
            aria-label={tooltip}
            data-testid="latency-badge"
            className={cn(
              "m-0 inline-flex cursor-default items-center gap-2 rounded-md border border-outline px-2.5 py-1 font-body text-xs font-medium text-on-surface",
              className,
            )}
          >
            <span
              className={cn("size-2 shrink-0 rounded-full", dotClassForRtt(rttMs, state))}
              aria-hidden
            />
            <span className="tabular-nums">{label}</span>
          </output>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs whitespace-pre-line font-body text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
