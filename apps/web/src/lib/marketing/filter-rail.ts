import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

const filterGroupLabel =
  "font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant";

/** Sticky scrollable filter rail on desktop catalogue hubs. */
export const MARKETING_FILTER_RAIL_STICKY =
  "lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto";

/** Uppercase section label in vertical filter rails. */
export const MARKETING_FILTER_GROUP_TITLE = cn(filterGroupLabel, "mb-3");

/** Accordion trigger for faceted filter groups (matches rail label typography). */
export const MARKETING_FILTER_ACCORDION_TRIGGER = cn(
  "py-2.5 hover:no-underline dark:text-on-surface-variant",
  filterGroupLabel,
);

/** Result count strip above filter groups. */
export const MARKETING_FILTER_RESULT_COUNT =
  "font-body text-xs font-normal uppercase leading-5 tracking-wide text-on-surface-variant";

/** Reset sticky rail behaviour inside mobile filter sheets. */
export const MARKETING_FILTER_RAIL_IN_SHEET =
  "static max-h-none overflow-visible border-0 pb-0 lg:pr-0";

/** Filter option row in vertical rails (sidebar + sheets). */
export const marketingFilterRailLink = (active: boolean) =>
  cn(
    "flex items-center rounded-md px-2 py-1.5 font-body text-sm transition-colors motion-reduce:transition-none",
    FOCUS_RING,
    active
      ? "bg-primary/10 font-medium text-primary"
      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
  );
