import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { TableSkeleton } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";
import type { ReactNode } from "react";

type SkeletonProps = {
  title: string;
  description?: string;
  kpiTiles?: number;
  tableRows?: number;
  tableColumns?: number;
};

const KPI_TILE_KEYS = ["kpi-0", "kpi-1", "kpi-2", "kpi-3", "kpi-4", "kpi-5"] as const;

function KpiStripSkeleton({ tiles }: { tiles: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      aria-busy="true"
      aria-label="Loading summary"
    >
      {KPI_TILE_KEYS.slice(0, tiles).map((id) => (
        <Skeleton key={id} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3" aria-busy="true">
      <Skeleton className="h-9 w-full max-w-md rounded-md" />
      <Skeleton className="h-9 w-32 rounded-full" />
      <Skeleton className="h-9 w-24 rounded-md" />
    </div>
  );
}

/** Loading state aligned with CatalogListShell layout. */
export function CatalogListPageSkeleton({
  title,
  description = "Loading…",
  kpiTiles = 3,
  tableRows = 10,
  tableColumns = 6,
}: SkeletonProps) {
  return (
    <CatalogListShell
      title={title}
      description={description}
      filterBar={<FilterBarSkeleton />}
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
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 font-label text-xs font-bold uppercase tracking-[0.12em] text-on-primary"
            >
              Try again
            </button>
          ) : null}
          <a
            href={listHref}
            className="inline-flex min-h-10 items-center rounded-md border border-outline-variant px-4 font-label text-xs uppercase tracking-[0.12em] text-on-surface-variant"
          >
            Back to {listLabel.toLowerCase()}
          </a>
        </div>
        {children}
      </div>
    </CatalogListShell>
  );
}
