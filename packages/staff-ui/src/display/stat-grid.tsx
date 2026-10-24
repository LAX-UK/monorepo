import type * as React from "react";
import { cn } from "../lib/cn.js";

export type StatItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  /** A short comparison or context line: "+12% vs last 30 days", "3 need photos". */
  hint?: React.ReactNode;
  hintTone?: "neutral" | "positive" | "negative";
};

/**
 * Headline numbers for a record or list, in one hairline card divided into cells. Numbers use
 * tabular figures and the md title size; no charts, so the page stays calm.
 */
export function StatGrid({
  items,
  label,
  className,
}: {
  items: readonly StatItem[];
  label: string;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-staff-md border border-staff-line bg-staff-line gap-px md:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-1 bg-staff-surface px-4 py-3">
          <span className="text-staff-xs text-staff-muted">{item.label}</span>
          <span className="font-staff-display text-staff-lg font-semibold text-staff-fg tabular-nums">
            {item.value}
          </span>
          {item.hint ? (
            <span
              className={cn(
                "text-staff-xs",
                item.hintTone === "positive"
                  ? "text-staff-success-fg"
                  : item.hintTone === "negative"
                    ? "text-staff-danger-fg"
                    : "text-staff-subtle",
              )}
            >
              {item.hint}
            </span>
          ) : null}
        </div>
      ))}
    </section>
  );
}
