import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingBreadcrumbItem = {
  label: ReactNode;
  href?: string;
  current?: boolean;
};

export type MarketingBreadcrumbProps = {
  items: readonly MarketingBreadcrumbItem[];
  className?: string;
};

/** Shared visible-breadcrumb styling for catalog hubs + content pages (matches detail wayfinding). */
export const MARKETING_HUB_BREADCRUMB_CLASS =
  "font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant md:text-xs";

/** Visible trail; pair with JSON-LD `BreadcrumbList` from `lib/seo/jsonld`. */
export function MarketingBreadcrumb({ items, className }: MarketingBreadcrumbProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-on-surface-variant", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li
            key={`${typeof item.label === "string" ? item.label : i}-${item.href ?? "current"}`}
            className="flex items-center gap-1.5"
          >
            {i > 0 ? (
              <span aria-hidden className="text-on-surface-variant/60">
                /
              </span>
            ) : null}
            {item.href && !item.current ? (
              <Link href={item.href} className={cn(FOCUS_RING, "rounded-sm hover:text-on-surface")}>
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={item.current ? "page" : undefined}
                className={item.current ? "text-on-surface" : ""}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
