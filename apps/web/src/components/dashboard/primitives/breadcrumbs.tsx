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
  /** Single-line trail: root link + chevron + truncated current page (mobile shell). */
  compact?: boolean;
  /** When true, render only the list markup (parent supplies the nav landmark). */
  inline?: boolean;
};

const linkClassName =
  "inline-flex min-h-11 -mx-2 items-center rounded-md px-2 text-primary hover:underline md:min-h-0 md:py-1";

export function Breadcrumbs({
  items,
  className,
  current,
  compact = false,
  inline = false,
}: BreadcrumbsProps) {
  if (items.length === 0 && !current) return null;

  if (compact) {
    const root = items[0];
    const lastItem = items[items.length - 1];
    const currentLabel =
      current ?? (lastItem && !lastItem.href ? lastItem.label : null) ?? lastItem?.label ?? null;

    if (!currentLabel) return null;

    const list = (
      <ol className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden text-on-surface-variant">
        {root?.href ? (
          <li className="inline-flex shrink-0 items-center">
            <Link href={root.href} className={linkClassName}>
              {root.label}
            </Link>
          </li>
        ) : null}
        {root?.href ? (
          <li className="inline-flex shrink-0 items-center" aria-hidden>
            <ChevronRight className="size-3.5 opacity-50" />
          </li>
        ) : null}
        <li className="inline-flex min-w-0 items-center">
          <span className="truncate text-on-surface" aria-current="page">
            {currentLabel}
          </span>
        </li>
      </ol>
    );

    if (inline) {
      return <div className={cn("min-w-0 font-body text-sm", className)}>{list}</div>;
    }

    return (
      <nav aria-label="Breadcrumb" className={cn("min-w-0 font-body text-sm", className)}>
        {list}
      </nav>
    );
  }

  const list = (
    <ol className="flex flex-wrap items-center gap-1 text-on-surface-variant">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden /> : null}
          {item.href ? (
            <Link href={item.href} className={linkClassName}>
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
  );

  if (inline) {
    return <div className={cn("font-body text-sm", className)}>{list}</div>;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("font-body text-sm", className)}>
      {list}
    </nav>
  );
}
