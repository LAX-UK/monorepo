import { Count, type LinkComponent } from "@auction/ui/lax";
import { ChevronRight } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";

export type LinkListItem = {
  id: string;
  /** Where the link goes, as a noun: "Payouts", "Run settlement". */
  label: string;
  /** One line on what is there: "Transfers to sellers, by status". */
  description?: string;
  href: string;
  /** Records waiting there; shown only above zero. */
  count?: number;
};

/**
 * The places a hub leads to, as one card of rows: label, an optional line on what is there, a
 * count when something waits, and a chevron. Rows are links with 44px targets, in the card style
 * of `AttentionList`, so a hub reads the same as Overview.
 */
export function LinkList({
  items,
  title,
  description,
  Link,
  className,
}: {
  items: readonly LinkListItem[];
  title: string;
  description?: React.ReactNode;
  Link: LinkComponent;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label={title}
      className={cn("rounded-staff-lg border border-staff-line bg-staff-surface", className)}
    >
      <div className="border-b border-staff-line-subtle px-4 py-3">
        <h2 className="font-staff text-staff-md font-semibold text-staff-fg">{title}</h2>
        {description ? <p className="text-staff-xs text-staff-muted">{description}</p> : null}
      </div>
      <ul className="divide-y divide-staff-line-subtle">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="staff-focus-inset group flex min-h-11 items-center gap-3 px-4 py-2.5 text-staff-sm transition-colors hover:staff-overlay-hover"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-staff-fg">{item.label}</span>
                {item.description ? (
                  <span className="text-staff-xs text-staff-muted">{item.description}</span>
                ) : null}
              </span>
              {item.count && item.count > 0 ? <Count value={item.count} /> : null}
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-staff-subtle transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
