import { MARKETING_CATALOG_GUTTER } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

type Props = {
  showDesktopFilters?: boolean;
  /** Desktop-only sort chip-strip placeholder (e.g. artists directory). */
  showDesktopSort?: boolean;
  showActiveChips?: boolean;
  className?: string;
};

const pulse = "animate-pulse rounded bg-surface-container-high";

/** Loading placeholder for sticky marketing catalogue toolbars (single-row mobile layout). */
export function MarketingCatalogToolbarSkeleton({
  showDesktopFilters = true,
  showDesktopSort = false,
  showActiveChips = false,
  className,
}: Props) {
  return (
    <>
      <div
        className={cn(
          "-mx-8 border-b border-border-hairline bg-surface/85 py-3 md:-mx-10 lg:-mx-14",
          className,
        )}
      >
        <div
          className={cn(
            "mx-auto max-w-[var(--container-max,1440px)] py-2 md:py-3",
            MARKETING_CATALOG_GUTTER,
          )}
        >
          <div className="flex h-12 min-h-12 items-center gap-2 md:h-14 md:min-h-14 md:gap-3">
            <div className={cn(pulse, "h-4 w-20 shrink-0")} />
            {showDesktopFilters ? (
              <div className="hidden min-w-0 flex-1 gap-2 md:flex">
                <div className={cn(pulse, "h-8 w-16 rounded-full")} />
                <div className={cn(pulse, "h-8 w-20 rounded-full")} />
                <div className={cn(pulse, "h-8 w-24 rounded-full")} />
              </div>
            ) : null}
            {showDesktopSort ? (
              <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
                <div className={cn(pulse, "h-4 w-10 shrink-0")} />
                <div className={cn(pulse, "h-8 w-20 rounded-full")} />
                <div className={cn(pulse, "h-8 w-24 rounded-full")} />
                <div className={cn(pulse, "h-8 w-20 rounded-full")} />
              </div>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className={cn(pulse, "h-10 w-24 shrink-0 md:hidden")} />
              <div className={cn(pulse, "h-10 w-28 shrink-0")} />
            </div>
          </div>
        </div>
      </div>
      {showActiveChips ? (
        <div className={cn("mb-4 flex flex-wrap gap-2 md:mb-6", MARKETING_CATALOG_GUTTER)}>
          <div className={cn(pulse, "h-11 w-24 rounded-full")} />
          <div className={cn(pulse, "h-11 w-28 rounded-full")} />
        </div>
      ) : null}
    </>
  );
}
