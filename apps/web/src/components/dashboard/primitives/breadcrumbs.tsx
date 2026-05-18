import { cn } from "@auction/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbsProps = {
  items: readonly BreadcrumbItem[];
  className?: string;
  /** Rendered after the trail (e.g. current page title). */
  current?: ReactNode;
};

export function Breadcrumbs({ items, className, current }: BreadcrumbsProps) {
  if (items.length === 0 && !current) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("font-body text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-on-surface-variant">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden />
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 -mx-2 items-center rounded-md px-2 text-primary hover:underline md:min-h-0 md:py-1"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
        {current ? (
          <li className="inline-flex items-center gap-1">
            {items.length > 0 ? (
              <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden />
            ) : null}
            <span className="text-on-surface" aria-current="page">
              {current}
            </span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
