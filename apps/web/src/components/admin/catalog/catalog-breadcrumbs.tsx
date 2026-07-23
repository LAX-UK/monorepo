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
  "flex flex-wrap items-center gap-x-2 gap-y-1 font-label text-sm font-normal normal-case tracking-normal";

/** Label-caps breadcrumb trail for catalog list/detail/form pages. */
export function CatalogBreadcrumbs({ segments, className }: Props) {
  if (segments.length === 0) return null;

  return (
    <span className={cn(trailClass, className)}>
      {segments.map((segment, index) => {
        const node: ReactNode = segment.href ? (
          <Link
            href={segment.href}
            className={cn(
              "text-on-surface-variant hover:text-secondary hover:underline",
              index < segments.length - 1 ? "max-w-[min(100%,14rem)] truncate" : "",
            )}
          >
            {segment.label}
          </Link>
        ) : (
          <span
            className={cn(
              index === segments.length - 1
                ? "font-semibold text-secondary"
                : "text-on-surface-variant",
              index > 0 && index < segments.length - 1 ? "max-w-[min(100%,14rem)] truncate" : "",
            )}
          >
            {segment.label}
          </span>
        );

        return (
          <span key={`${segment.label}-${index}`} className="inline-flex items-center gap-x-2">
            {index > 0 ? <span className="text-on-surface-variant">/</span> : null}
            {node}
          </span>
        );
      })}
    </span>
  );
}
