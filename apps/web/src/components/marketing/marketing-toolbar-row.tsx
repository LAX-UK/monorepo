import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingToolbarRowProps = {
  /** Result count or context line (e.g. "24 lots"). */
  countLabel?: string;
  /** Desktop-only inline filters (`hidden` below `lg` when `mobileFilterTrigger` is set). */
  filters?: ReactNode;
  sort?: ReactNode;
  /** View switcher, copy link, etc. */
  trailing?: ReactNode;
  /** Mobile/tablet filter sheet trigger (`lg:hidden`). */
  mobileFilterTrigger?: ReactNode;
  /** When true, trailing controls move to a second row below `lg`. */
  stackTrailingOnMobile?: boolean;
  /** Home sections: only stack when both `filters` and `trailing` are set. */
  stackTrailingRequiresFilters?: boolean;
  /** Full-width row below the primary toolbar (e.g. archive status chips). */
  secondaryRow?: ReactNode;
  /** Full-width removable active filter chips. */
  activeFiltersRow?: ReactNode;
};

/** Shared count + filter + sort + trailing row for marketing toolbars. */
export function MarketingToolbarRow({
  countLabel,
  filters,
  sort,
  trailing,
  mobileFilterTrigger,
  stackTrailingOnMobile = false,
  stackTrailingRequiresFilters = false,
  secondaryRow,
  activeFiltersRow,
}: MarketingToolbarRowProps) {
  const hideFiltersOnMobile = Boolean(mobileFilterTrigger);
  const stackTrailing =
    stackTrailingOnMobile &&
    Boolean(trailing) &&
    (stackTrailingRequiresFilters ? Boolean(filters) : Boolean(mobileFilterTrigger || !filters));

  const countClassName = hideFiltersOnMobile
    ? "min-w-0 flex-1 truncate font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant tabular-nums sm:max-w-none lg:max-w-[10rem] lg:flex-none"
    : countLabel
      ? "min-w-0 max-w-[40%] shrink truncate font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant tabular-nums sm:max-w-[10rem]"
      : "";

  return (
    <div className="flex flex-col gap-2 md:gap-0">
      <div className="flex min-w-0 min-h-12 items-center gap-2 md:min-h-14 md:gap-3">
        {countLabel ? <p className={countClassName}>{countLabel}</p> : null}
        {filters ? (
          <div
            className={cn(
              "min-w-0 flex-1 md:items-center",
              hideFiltersOnMobile ? "hidden lg:flex" : "flex",
            )}
          >
            {filters}
          </div>
        ) : null}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 md:gap-3",
            countLabel || filters ? "ml-auto" : "",
          )}
        >
          {mobileFilterTrigger ? (
            <div className="shrink-0 lg:hidden">{mobileFilterTrigger}</div>
          ) : null}
          {sort ? <div className="shrink-0">{sort}</div> : null}
          {trailing ? (
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 md:gap-3",
                stackTrailing && "hidden lg:flex",
              )}
            >
              {trailing}
            </div>
          ) : null}
        </div>
      </div>
      {stackTrailing ? (
        <div
          data-testid="mobile-trailing-row"
          className="flex items-center justify-end gap-2 border-t border-border-hairline pt-2 lg:hidden"
        >
          {trailing}
        </div>
      ) : null}
      {secondaryRow ? (
        <div className="hidden border-t border-border-hairline/60 pt-2 lg:block">
          {secondaryRow}
        </div>
      ) : null}
      {activeFiltersRow ? <div className="pt-2">{activeFiltersRow}</div> : null}
    </div>
  );
}
