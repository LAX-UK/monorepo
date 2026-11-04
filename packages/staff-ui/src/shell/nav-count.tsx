import { formatCount } from "@auction/ui/lax";
import { cn } from "../lib/cn.js";
import type { StaffNavCountTone } from "./types.js";

/** The pill colours per tone, from the staff tokens: extend here rather than branching below. */
const PILL_BY_TONE: Record<StaffNavCountTone, string> = {
  neutral: "bg-staff-neutral-bg text-staff-neutral-fg",
  attention: "bg-staff-ink text-staff-on-ink",
  warning: "bg-staff-warning-bg text-staff-warning-fg",
  danger: "bg-staff-danger-bg text-staff-danger-fg",
};

/** The collapsed rail's dot, which has no number to carry the tone. */
const DOT_BY_TONE: Record<StaffNavCountTone, string> = {
  neutral: "bg-staff-ink",
  attention: "bg-staff-ink",
  warning: "bg-staff-warning-dot",
  danger: "bg-staff-danger-dot",
};

/** What the count means to a screen reader, so colour is never the only signal. */
export function navCountText(count: number, tone: StaffNavCountTone): string {
  return `${count} ${tone === "danger" ? "overdue" : "waiting"}`;
}

/** The number beside a nav label. Decorative: the link's visually hidden text carries the meaning. */
export function NavCountPill({ value, tone }: { value: number; tone: StaffNavCountTone }) {
  return (
    <span
      aria-hidden
      data-tone={tone}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-staff-xs font-medium tabular-nums",
        PILL_BY_TONE[tone],
      )}
    >
      {formatCount(value)}
    </span>
  );
}

/** The dot on a collapsed rail icon. */
export function NavCountDot({ tone }: { tone: StaffNavCountTone }) {
  return (
    <span
      aria-hidden
      data-tone={tone}
      className={cn(
        "absolute -top-1 -right-1 size-2 rounded-full ring-2 ring-staff-sunken",
        DOT_BY_TONE[tone],
      )}
    />
  );
}
