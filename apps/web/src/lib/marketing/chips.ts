import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

/** Outline → tinted filter pill rendered in a horizontal `MarketingChipStrip`
 * (search categories, saleroom status). Single source of truth so every
 * marketing filter strip shares the same height, tracking, and focus ring. */
export const marketingFilterChipStrip = (active: boolean) =>
  cn(
    "inline-flex min-h-11 shrink-0 snap-start items-center rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider transition-colors motion-reduce:transition-none",
    FOCUS_RING,
    active
      ? "border-primary bg-primary/10 text-on-surface"
      : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
  );

/** Same filter family rendered as a full-width vertical list row (filter sheets). */
export const marketingFilterChipList = (active: boolean) =>
  cn(
    "flex min-h-11 w-full items-center rounded-lg border px-4 py-2 font-body text-sm transition-colors motion-reduce:transition-none",
    FOCUS_RING,
    active
      ? "border-primary bg-primary/10 text-on-surface"
      : "border-outline-variant/40 text-on-surface-variant hover:border-primary/30",
  );
