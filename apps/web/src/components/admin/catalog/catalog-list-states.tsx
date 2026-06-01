import {
  AdminListFilterBarSkeleton,
  KpiStripSkeleton,
} from "@/components/admin/admin-loading-skeletons";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { TableSkeleton } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Skeleton } from "@auction/ui/components/skeleton";
import Link from "next/link";
import type { ReactNode } from "react";

import { CatalogBreadcrumbs } from "./catalog-breadcrumbs";

type SkeletonProps = {
  title: string;
  description?: string;
  kpiTiles?: number;
  tableRows?: number;
  tableColumns?: number;
  showFilterBar?: boolean;
};

/** Loading state aligned with CatalogListShell layout. */
export function CatalogListPageSkeleton({
  title,
  description = "Loading…",
  kpiTiles = 3,
  tableRows = 10,
  tableColumns = 6,
  showFilterBar = true,
}: SkeletonProps) {
  return (
    <CatalogListShell
      title={title}
      description={description}
      filterBar={showFilterBar ? <AdminListFilterBarSkeleton /> : null}
      kpiStrip={kpiTiles > 0 ? <KpiStripSkeleton tiles={kpiTiles} /> : null}
      pagination={<Skeleton className="h-10 w-full max-w-md" />}
    >
      <div aria-busy="true">
        <TableSkeleton rows={tableRows} columns={tableColumns} />
      </div>
    </CatalogListShell>
  );
}

type ErrorProps = {
  title: string;
  listLabel: string;
  listHref: string;
  message?: string;
  reset?: () => void;
  children?: ReactNode;
};

/** Error recovery inside CatalogListShell for consistent catalog list UX. */
export function CatalogListErrorShell({
  title,
  listLabel,
  listHref,
  message = "Something went wrong loading this page. Try again or return to the list.",
  reset,
  children,
}: ErrorProps) {
  return (
    <CatalogListShell
      title={title}
      breadcrumbs={
        <CatalogBreadcrumbs segments={[{ label: listLabel, href: listHref }, { label: "Error" }]} />
      }
    >
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border-hairline bg-surface-container-low/30 p-6">
        <h2 className="font-headline text-lg text-on-surface">
          Could not load {title.toLowerCase()}
        </h2>
        <p className="font-body text-sm text-on-surface-variant">{message}</p>
        <div className="flex flex-wrap gap-2">
          {reset ? (
            <Button
              type="button"
              variant="default"
              onClick={reset}
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 font-label text-xs font-bold uppercase tracking-[0.12em] text-on-primary"
            >
              Try again
            </Button>
          ) : null}
          <Button variant="secondary" asChild>
            <Link href={listHref}>Back to {listLabel.toLowerCase()}</Link>
          </Button>
        </div>
        {children}
      </div>
    </CatalogListShell>
  );
}
