import { RailSection } from "@/components/admin/detail-rail/rail-section";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type KpiStackItem = {
  id: string;
  label: string;
  value: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
};

type Props = {
  items: readonly KpiStackItem[];
  title?: string;
};

const toneClass = {
  default: "text-on-surface",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-positive",
} as const;

/** Vertical mini KPI stack for detail rails (sale stats, user metrics, etc.). */
export function KpiStackRail({ items, title = "At a glance" }: Props) {
  if (items.length === 0) return null;

  return (
    <RailSection title={title}>
      <dl className="space-y-2">
        {items.map((item) => {
          const isPlainValue = typeof item.value === "string" || typeof item.value === "number";
          return (
            <div
              key={item.id}
              className="flex items-baseline justify-between gap-3 rounded-md border border-border-hairline/50 bg-surface-container-low/40 px-3 py-2"
            >
              <dt className="font-label text-[10px] uppercase tracking-wide text-secondary">
                {item.label}
              </dt>
              <dd
                className={cn(
                  isPlainValue && "font-headline text-lg font-semibold tabular-nums",
                  toneClass[item.tone ?? "default"],
                )}
              >
                {item.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </RailSection>
  );
}
