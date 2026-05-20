import { RailSection } from "@/components/admin/detail-rail/rail-section";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type RelatedEntityItem = {
  id: string;
  kind: string;
  label: string;
  href: string;
  meta?: string;
  icon?: ReactNode;
};

type Props = {
  items: readonly RelatedEntityItem[];
  title?: string;
  emptyMessage?: string;
};

/** Typed links to related records in the detail rail. */
export function RelatedEntitiesRail({
  items,
  title = "Related",
  emptyMessage = "No related records.",
}: Props) {
  return (
    <RailSection title={title}>
      {items.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-start gap-2 rounded-md border border-border-hairline/60 bg-surface-container-low/50 px-3 py-2",
                  "transition-colors hover:border-primary/30 hover:bg-primary/5",
                )}
              >
                {item.icon ? (
                  <span className="mt-0.5 shrink-0 text-on-surface-variant">{item.icon}</span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block font-label text-[10px] uppercase tracking-wide text-secondary">
                    {item.kind}
                  </span>
                  <span className="block truncate font-body text-sm font-medium text-on-surface">
                    {item.label}
                  </span>
                  {item.meta ? (
                    <span className="block truncate font-body text-xs text-on-surface-variant">
                      {item.meta}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </RailSection>
  );
}
