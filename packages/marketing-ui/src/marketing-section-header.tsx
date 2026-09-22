import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingSectionHeaderProps = {
  heading: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  headingBlockClassName?: string;
  subtitleClassName?: string;
  actionClassName?: string;
};

export function MarketingSectionHeader({
  heading,
  subtitle,
  action,
  className,
  headingBlockClassName,
  subtitleClassName,
  actionClassName,
}: MarketingSectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className={cn("flex max-w-[45rem] flex-col gap-2", headingBlockClassName)}>
        {heading}
        {subtitle ? (
          <p
            className={cn(
              "font-headline text-[length:var(--text-display-sm,1.125rem)] font-normal leading-snug text-on-surface-variant",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className={cn("shrink-0", actionClassName)}>{action}</div> : null}
    </div>
  );
}
