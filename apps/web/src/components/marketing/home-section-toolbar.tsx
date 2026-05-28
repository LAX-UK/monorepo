import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type HomeSectionToolbarProps = {
  countLabel: string;
  trailing?: ReactNode;
  filters?: ReactNode;
  className?: string;
};

/** Single-row count + view switcher for home catalogue sections. */
export function HomeSectionToolbar({
  countLabel,
  trailing,
  filters,
  className,
}: HomeSectionToolbarProps) {
  return (
    <MarketingListToolbar
      className={cn(
        "rounded-lg border border-border-hairline bg-white/80 dark:bg-surface-container-low/40",
        className,
      )}
      countLabel={countLabel}
      filters={filters}
      trailing={trailing}
    />
  );
}
