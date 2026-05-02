import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type SectionCtaProps = {
  title: string;
  description?: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
};

/**
 * Recurring marketing strip: headline, optional body, primary + optional secondary actions.
 */
export function SectionCta({ title, description, primary, secondary, className }: SectionCtaProps) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-outline-variant/50 bg-surface-container-low px-6 py-5 md:flex-row md:items-center md:justify-between md:gap-8",
        className,
      )}
      aria-label={title}
    >
      <div className="min-w-0 space-y-2">
        <p className="font-headline text-lg font-semibold text-on-surface md:text-xl">{title}</p>
        {description ? (
          <p className="max-w-prose text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
        {primary}
        {secondary}
      </div>
    </aside>
  );
}
