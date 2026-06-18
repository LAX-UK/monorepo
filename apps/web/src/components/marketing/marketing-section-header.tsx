import { SectionHeader } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingSectionHeaderProps = {
  /** Section heading (pass `DisplayHeading` for correct outline). */
  heading: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function MarketingSectionHeader({
  heading,
  subtitle,
  action,
  className,
}: MarketingSectionHeaderProps) {
  return (
    <SectionHeader
      className={className}
      heading={
        <div className="flex max-w-[720px] flex-col gap-2">
          {heading}
          {subtitle ? (
            <p className="font-headline text-[length:var(--text-display-sm)] font-normal leading-snug text-on-surface-variant">
              {subtitle}
            </p>
          ) : null}
        </div>
      }
      action={action}
    />
  );
}
