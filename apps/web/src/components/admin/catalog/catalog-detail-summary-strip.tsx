import { CatalogKpiCard } from "@/components/admin/catalog/catalog-kpi-card";
import type { ReactNode } from "react";

export type CatalogDetailSummaryItem = {
  id: string;
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
};

type Props = {
  items: readonly CatalogDetailSummaryItem[];
};

/** Compact metric row for catalog detail overview tabs. */
export function CatalogDetailSummaryStrip({ items }: Props) {
  if (items.length === 0) return null;

  const colClass =
    items.length <= 2
      ? "grid-cols-2"
      : items.length === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

  return (
    <div className={`grid min-w-0 items-stretch gap-3 ${colClass}`}>
      {items.map((item) => (
        <CatalogKpiCard
          key={item.id}
          label={item.label}
          value={item.value}
          {...(item.hint ? { hint: item.hint } : {})}
          {...(item.href ? { href: item.href } : {})}
        />
      ))}
    </div>
  );
}
