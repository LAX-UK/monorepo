import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type CatalogBreadcrumbSegment = {
  label: string;
  href?: string;
};

type Props = {
  segments: readonly CatalogBreadcrumbSegment[];
  className?: string;
};

const trailClass =
  "flex flex-wrap items-center gap-x-3 gap-y-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]";

/** Label-caps breadcrumb trail for catalog list/detail/form pages. */
export function CatalogBreadcrumbs({ segments, className }: Props) {
  if (segments.length === 0) return null;

  return (
    <span className={cn(trailClass, className)}>
      {segments.map((segment, index) => {
        const isFirst = index === 0;
        const prefix = isFirst ? "← " : "";
        const node: ReactNode = segment.href ? (
          <Link
            href={segment.href}
            className={cn(
              "text-primary hover:underline",
              !isFirst && index < segments.length - 1 ? "max-w-[min(100%,14rem)] truncate" : "",
            )}
          >
            {prefix}
            {segment.label}
          </Link>
        ) : (
          <span
            className={cn(
              index === segments.length - 1 ? "text-on-surface" : "text-on-surface-variant",
              index > 0 && index < segments.length - 1 ? "max-w-[min(100%,14rem)] truncate" : "",
            )}
          >
            {prefix}
            {segment.label}
          </span>
        );

        return (
          <span key={`${segment.label}-${index}`} className="inline-flex items-center gap-x-3">
            {index > 0 ? <span className="text-on-surface-variant">/</span> : null}
            {node}
          </span>
        );
      })}
    </span>
  );
}
