import { AdminLotsBoard } from "@/components/admin/admin-lots-board";
import type { AdminLotTableRow } from "@/components/admin/admin-lots-data-table";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { ResetFiltersLink } from "@/components/admin/reset-filters-link";
import { ShareFiltersButton } from "@/components/admin/share-filters-button";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { Button } from "@/components/ui/button";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { LotStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const statuses: (LotStatus | "all")[] = [
  "all",
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
];

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; view?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status === "all" || !sp.status ? undefined : (sp.status as LotStatus);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const viewPipeline = sp.view === "pipeline";
  const q = (sp.q ?? "").trim().slice(0, 200);

  let rows: Awaited<ReturnType<typeof getAdminLotList>> = [];
  let listError: string | null = null;
  try {
    rows = await getAdminLotList({
      limit: viewPipeline ? 200 : 100,
      offset: 0,
      ...(viewPipeline || !statusFilter ? {} : { status: statusFilter }),
      ...(q ? { q } : {}),
    });
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load auctions.";
  }

  const lotTableRows: AdminLotTableRow[] = rows.map((a) => ({
    id: a.id,
    title: a.title,
    auctionType: a.auctionType,
    status: a.status,
    endTimeLabel: a.endTime.toISOString().slice(0, 16).replace("T", " "),
    currentPrice: a.currentPrice,
  }));

  const statusChips = (
    <FilterChipRow
      label="Filter by status"
      chips={statuses.map((s) => {
        const qs = new URLSearchParams();
        if (s !== "all") qs.set("status", s);
        if (viewPipeline) qs.set("view", "pipeline");
        if (q) qs.set("q", q);
        const href = qs.toString() ? `/admin/lots?${qs.toString()}` : "/admin/lots";
        return {
          id: s,
          label: s,
          href,
          active: (s === "all" && !sp.status) || sp.status === s,
        };
      })}
    />
  );

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Lots"
        description="Publish, schedule, and triage catalog lots. Use bulk actions after selecting rows (desktop and mobile)."
        actions={
          <div className="flex flex-wrap gap-2">
            <ShareFiltersButton />
            <ResetFiltersLink
              active={Boolean(statusFilter || q || viewPipeline)}
              href="/admin/lots"
            />
            <Button variant="primary" asChild>
              <Link href="/admin/lots/new">
                <Plus className="size-4" aria-hidden />
                New lot
              </Link>
            </Button>
          </div>
        }
      />

      {error || listError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load auctions</AlertTitle>
          <AlertDescription>{listError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!listError && !viewPipeline && rows.length === 0 ? (
        <EmptyState
          title={q || statusFilter ? "No matching lots" : "No lots yet"}
          description={
            q || statusFilter
              ? "Clear the search or status filter to broaden the list."
              : "Create the first draft lot, assign a seller, and prepare it for publication."
          }
          action={
            !q && !statusFilter ? (
              <Button variant="primary" asChild>
                <Link href="/admin/lots/new">
                  <Plus className="size-4" aria-hidden />
                  New lot
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" asChild>
                <Link href="/admin/lots">Clear filters</Link>
              </Button>
            )
          }
        />
      ) : (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <AdminLotsBoard
            rows={lotTableRows}
            fullLots={rows}
            viewPipeline={viewPipeline}
            listError={listError}
            urlError={error}
            statusChips={statusChips}
            searchQuery={q}
          />
        </Suspense>
      )}
    </AppScreen>
  );
}
