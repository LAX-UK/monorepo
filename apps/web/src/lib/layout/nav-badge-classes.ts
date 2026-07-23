import type { NavBadgeTone } from "@/lib/shell/contracts";
import { cn } from "@auction/ui";

const TONE_CLASS: Record<NavBadgeTone, string> = {
  default: "bg-lot-orange text-white",
  warning: "bg-warning text-on-warning",
  danger: "bg-error text-on-error",
  live: "bg-live-red text-white",
};

const DOT_TONE_CLASS: Record<NavBadgeTone, string> = {
  default: "bg-lot-orange",
  warning: "bg-warning",
  danger: "bg-error",
  live: "bg-live-red",
};

/** Count pills for urgent queue badges; dots for lower-priority tones. */
export function navBadgeShowsCount(tone: NavBadgeTone = "default"): boolean {
  return tone === "danger" || tone === "warning";
}

export function navBadgeClassName(tone: NavBadgeTone = "default", className?: string): string {
  return cn(
    "rounded-full px-1.5 py-0 font-label text-[9px] leading-none",
    TONE_CLASS[tone],
    className,
  );
}

export function navBadgeDotClassName(tone: NavBadgeTone = "default", className?: string): string {
  return cn("size-2 shrink-0 rounded-full", DOT_TONE_CLASS[tone], className);
}
