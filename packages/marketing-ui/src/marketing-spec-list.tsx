import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingSpecListItem = {
  label: string;
  value: ReactNode;
};

export type MarketingSpecListProps = {
  items: readonly MarketingSpecListItem[];
  className?: string;
};

/** Key/value facts (year, medium, dimensions) as a description list: muted label column, value beside it. */
export function MarketingSpecList({ items, className }: MarketingSpecListProps) {
  if (items.length === 0) return null;
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(0,7.75rem)_minmax(0,1fr)] items-baseline gap-x-6 gap-y-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-sm text-on-surface-variant">{item.label}</dt>
          <dd className="min-w-0 break-words text-base text-on-surface">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
