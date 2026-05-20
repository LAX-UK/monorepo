import type { NavBadgeTone } from "@/lib/shell/contracts";
import { cn } from "@auction/ui";

const TONE_CLASS: Record<NavBadgeTone, string> = {
  default: "bg-lot-orange text-white",
  warning: "bg-warning text-on-warning",
  danger: "bg-error text-on-error",
  live: "bg-live-red text-white",
};

export function navBadgeClassName(tone: NavBadgeTone = "default", className?: string): string {
  return cn(
    "rounded-full px-1.5 py-0 font-label text-[9px] leading-none",
    TONE_CLASS[tone],
    className,
  );
}
