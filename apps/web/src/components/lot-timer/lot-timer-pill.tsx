import { LiveDot, cn } from "@auction/ui";
import { Clock } from "lucide-react";
import type { LotTimerState } from "./classify";

function assertNever(x: never): never {
  throw new Error(`Unexpected lot timer state: ${String(x)}`);
}

const PILL_BASE =
  "pointer-events-none absolute bottom-3 left-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-sm border px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[0.1em] backdrop-blur-sm";

const SHELL_LIVE =
  "border-transparent bg-brand-900/85 text-white dark:border-transparent dark:bg-black/80 dark:text-white";

const SHELL_MUTED =
  "border-transparent bg-brand-900/70 text-white/70 dark:border-transparent dark:bg-black/70 dark:text-white/70";

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
            <span>Live · </span>
            <span className="tabular-nums" aria-hidden>
              {clockText ?? "—"}
            </span>
          </span>
        </output>
      );
    case "opensSoon":
      return (
        <output aria-live="off" aria-label={aria} className={cn(PILL_BASE, SHELL_LIVE)}>
          <Clock className="size-3.5 shrink-0 text-accent-gold" aria-hidden />
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
