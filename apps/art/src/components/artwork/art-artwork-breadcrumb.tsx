import type { ArtworkBreadcrumbItem } from "@/lib/artwork/artwork-detail.vm";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@auction/ui/components/breadcrumb";
import Link from "next/link";
import { Fragment } from "react";

/** Mixed-case trail above the hero with the current page in medium weight (Figma 426:2581). */
export function ArtArtworkBreadcrumb({ items }: { items: readonly ArtworkBreadcrumbItem[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-1 text-sm text-on-surface-variant sm:gap-1.5">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${item.href ?? "current"}`}>
            {index > 0 ? <BreadcrumbSeparator>/</BreadcrumbSeparator> : null}
            <BreadcrumbItem className="min-w-0">
              {item.href ? (
                <BreadcrumbLink asChild className="art-focus-ring rounded-sm hover:text-on-surface">
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate font-medium text-on-surface">
                  {item.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
