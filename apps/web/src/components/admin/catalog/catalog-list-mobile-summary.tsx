import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type CatalogListMobileMetric = {
  id: string;
  label: string;
  value: string;
  /** Optional trend hint, e.g. "+12% vs prior period" */
  hint?: string;
};

type Props = {
  segments?: readonly (string | null | undefined | false)[];
  metrics?: readonly CatalogListMobileMetric[];
  className?: string;
  prefix?: ReactNode;
};

/** KPI summary for catalog list pages on mobile (when kpiStrip is hidden). */
export function CatalogListMobileSummary({ segments, metrics, className, prefix }: Props) {
  const parts = (segments ?? []).filter((s): s is string => Boolean(s));
  const hasMetrics = metrics != null && metrics.length > 0;

  if (parts.length === 0 && !hasMetrics) return null;

  if (hasMetrics) {
    return (
      <div
        className={cn("flex flex-wrap gap-2", className)}
        aria-live="polite"
        aria-label="List summary"
      >
        {prefix}
        {metrics.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-border-hairline bg-surface-container-low/50 px-2.5 py-1.5"
          >
            <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              {m.label}
            </p>
            <p className="font-body text-sm font-medium tabular-nums text-on-surface">{m.value}</p>
            {m.hint ? (
              <p className="font-body text-[10px] text-on-surface-variant">{m.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className={cn("font-body text-sm text-on-surface-variant", className)} aria-live="polite">
      {prefix}
      {parts.join(" · ")}
    </p>
  );
}
