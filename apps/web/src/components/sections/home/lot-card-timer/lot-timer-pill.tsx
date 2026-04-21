import { MaterialIcon } from "@/components/ui/material-icon";
import { cn, LiveDot } from "@auction/ui";
import type { LotTimerState } from "./classify";

function assertNever(x: never): never {
  throw new Error(`Unexpected lot timer state: ${String(x)}`);
}

const PILL_BASE =
  "pointer-events-none absolute left-3 top-3 z-10 inline-flex max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-full border px-2.5 py-1 font-label text-[11px] uppercase tracking-[0.06em] backdrop-blur-sm";

const SHELL_LIVE =
  "border-nav-border/60 bg-surface/85 text-brand-900 dark:border-outline-variant/20 dark:bg-surface-container-high/80 dark:text-on-surface";

const SHELL_MUTED =
  "border-nav-border/40 bg-surface/70 text-brand-400 dark:border-outline-variant/20 dark:text-on-surface-variant";

function ariaLabelFor(state: LotTimerState, clockText?: string): string {
  switch (state.kind) {
    case "live":
      return clockText ? `Live auction. Ends in ${clockText}.` : "Live auction.";
    case "opensSoon":
      return clockText ? `Opens in ${clockText}.` : "Opening soon.";
    case "closed":
      return "Auction closed.";
    case "cancelled":
      return "Auction cancelled.";
    case "unknown":
      return "Auction timing unavailable. Coming soon.";
    default:
      return assertNever(state);
  }
}

export function LotTimerPill({ state, clockText }: { state: LotTimerState; clockText?: string }) {
  const aria = ariaLabelFor(state, clockText);

  switch (state.kind) {
    case "live":
      return (
        <output aria-live="off" aria-label={aria} className={cn(PILL_BASE, SHELL_LIVE)}>
          <LiveDot size="sm" />
          <span className="min-w-0">
            <span>Ends in </span>
            <span className="tabular-nums" aria-hidden>
              {clockText ?? "—"}
            </span>
          </span>
        </output>
      );
    case "opensSoon":
      return (
        <output aria-live="off" aria-label={aria} className={cn(PILL_BASE, SHELL_LIVE)}>
          <MaterialIcon name="schedule" className="size-4 shrink-0 text-accent-gold" aria-hidden />
          <span className="min-w-0">
            <span>Opens in </span>
            <span className="tabular-nums" aria-hidden>
              {clockText ?? "—"}
            </span>
          </span>
        </output>
      );
    case "closed":
      return (
        <output aria-live="off" aria-label={aria} className={cn(PILL_BASE, SHELL_MUTED)}>
          Closed
        </output>
      );
    case "cancelled":
      return (
        <output aria-live="off" aria-label={aria} className={cn(PILL_BASE, SHELL_MUTED)}>
          Cancelled
        </output>
      );
    case "unknown":
      return (
        <output aria-live="off" aria-label={aria} className={cn(PILL_BASE, SHELL_MUTED)}>
          Soon
        </output>
      );
    default:
      return assertNever(state);
  }
}
