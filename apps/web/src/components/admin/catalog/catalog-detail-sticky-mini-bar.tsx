import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type CatalogDetailStickyMiniItem = {
  id: string;
  label: string;
  value: ReactNode;
};

type Props = {
  items: readonly CatalogDetailStickyMiniItem[];
};

/** Compact metrics row inside the sticky subnav (2 key facts while scrolling). */
export function CatalogDetailStickyMiniBar({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-hairline/60 px-1 py-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-baseline gap-1.5">
          <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            {item.label}
          </span>
          <span className={cn("font-body text-sm font-medium tabular-nums text-on-surface")}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
