import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingSectionHeaderProps = {
  heading: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  subtitleClassName?: string;
};

/**
 * One section header for every product: the title on the left and its action ("View all") on the
 * right, sitting on the title's last baseline at every width. The action never wraps above or
 * below the title; a subtitle runs under the row.
 */
export function MarketingSectionHeader({
  heading,
  subtitle,
  action,
  className,
  subtitleClassName,
}: MarketingSectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline-last justify-between gap-4">
        <div className="min-w-0 max-w-[45rem]">{heading}</div>
        {action ? <div className="shrink-0 whitespace-nowrap">{action}</div> : null}
      </div>
      {subtitle ? (
        <p
          className={cn(
            "max-w-[45rem] font-headline text-[length:var(--text-display-sm,1.125rem)] font-normal leading-snug text-on-surface-variant",
            subtitleClassName,
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
