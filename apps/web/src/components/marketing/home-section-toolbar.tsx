import { MarketingToolbarRow } from "@/components/marketing/marketing-toolbar-row";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type HomeSectionToolbarProps = {
  countLabel: string;
  trailing?: ReactNode;
  filters?: ReactNode;
  /** On mobile, move trailing controls to a second row below count + filters. */
  stackControlsOnMobile?: boolean;
  className?: string;
};

/** Static inset toolbar for home catalogue sections (non-sticky). */
export function HomeSectionToolbar({
  countLabel,
  trailing,
  filters,
  stackControlsOnMobile = false,
  className,
}: HomeSectionToolbarProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-hairline bg-white/80 px-4 py-2 dark:bg-surface-container-low/40 md:px-5 md:py-3",
        className,
      )}
    >
      <MarketingToolbarRow
        countLabel={countLabel}
        {...(filters ? { filters } : {})}
        {...(trailing ? { trailing } : {})}
        stackTrailingOnMobile={stackControlsOnMobile}
        stackTrailingRequiresFilters
      />
    </div>
  );
}
