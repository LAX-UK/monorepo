import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  segments: readonly (string | null | undefined | false)[];
  className?: string;
  /** Optional leading icon or label */
  prefix?: ReactNode;
};

/** One-line KPI summary for catalog list pages on mobile (when kpiStrip is hidden). */
export function CatalogListMobileSummary({ segments, className, prefix }: Props) {
  const parts = segments.filter((s): s is string => Boolean(s));
  if (parts.length === 0) return null;

  return (
    <p className={cn("font-body text-sm text-on-surface-variant", className)} aria-live="polite">
      {prefix}
      {parts.join(" · ")}
    </p>
  );
}
