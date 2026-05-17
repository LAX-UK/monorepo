import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminLotsBoard } from "@/components/admin/admin-lots-board";
import type { AdminLotTableRow } from "@/components/admin/admin-lots-board";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { LotFilterForm } from "@/components/admin/lot-filter-form";
import { Button } from "@/components/ui/button";
import { lotsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { lotStatusLabel } from "@/lib/admin/status-badge-variants";
import { getAdminArtistList, getAdminSalesList } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import type { LotStatus } from "@auction/types";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
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

type LotSort = "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc" | "sellerAsc";
const VALID_SORTS: LotSort[] = ["createdDesc", "endingAsc", "hammerDesc", "endedDesc", "sellerAsc"];

export default async function AdminLotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    view?: string;
    q?: string;
    artistId?: string;
    saleId?: string;
    categoryId?: string;
    sort?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const { sort: _urlSort, ...lotSp } = sp;
  const sort = VALID_SORTS.includes(sp.sort as LotSort) ? (sp.sort as LotSort) : undefined;
  const query = lotsListController.parseQuery({
    ...lotSp,
    ...(sort ? { sort } : {}),
  });

  const [lotResult, artistListResult, salesRows, categoryReader] = await Promise.allSettled([
    lotsListController.fetch(query),
    getAdminArtistList({ includeArchived: false, limit: 500 }).catch(() => ({
      rows: [],
      total: 0,
    })),
    getAdminSalesList({ limit: 200 }).catch(() => []),
    getServerCategoryReader()
      .then((r) => r.tree())
      .catch((): import("@auction/types").CategoryNode[] => []),
  ]);

  const lotRows = lotResult.status === "fulfilled" ? lotResult.value.rows : [];
  const listError =
    lotResult.status === "rejected"
      ? lotResult.reason instanceof Error
        ? lotResult.reason.message
        : "Could not load lots."
      : null;
  const artistOptions = artistListResult.status === "fulfilled" ? artistListResult.value.rows : [];
  const saleOptions = salesRows.status === "fulfilled" ? salesRows.value.map((r) => r.sale) : [];
  const categories = categoryReader.status === "fulfilled" ? categoryReader.value : [];

  const viewPipeline = query.viewPipeline ?? false;
  const statusFilter = query.status;
  const q = query.q ?? "";
  const artistId = query.artistId ?? "";
  const saleId = query.saleId ?? "";
  const categoryId = query.categoryId ?? "";

  const hasFilters = !!(
    statusFilter ||
    q ||
    artistId ||
    saleId ||
    categoryId ||
    sort ||
    viewPipeline
  );

  const lotTableRows: AdminLotTableRow[] = lotRows.map((a) => ({
    id: a.id,
    title: a.title,
    auctionType: a.auctionType,
    status: a.status,
    endTimeIso: a.endTime.toISOString(),
    endTimeLabel: a.endTime.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    currentPrice: a.currentPrice,
  }));

  const chip = (patch: Record<string, string | number | boolean | undefined | null | "">) =>
    buildListHref("/admin/lots", sp, { ...patch, offset: 0 });

  const statusChips = (
    <FilterChipRow
      label="Filter by status"
      chips={statuses.map((s) => {
        const href =
          s === "all"
            ? chip({ status: "" })
            : chip({
                status: s,
              });
        return {
          id: s,
          label: s === "all" ? "All" : (lotStatusLabel[s] ?? s),
          href,
          active: (s === "all" && !sp.status) || sp.status === s,
        };
      })}
    />
  );

  const pagination =
    !listError && !viewPipeline && (query.offset > 0 || lotRows.length === query.limit) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={lotRows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/lots", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          lotRows.length === query.limit
            ? buildListHref("/admin/lots", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Lots"
      description="Publish, schedule, and triage catalog lots. Use bulk actions after selecting rows (desktop and mobile)."
      primaryAction={
        <Button variant="primary" asChild>
          <Link href="/admin/lots/new">
            <Plus className="size-4" aria-hidden />
            New lot
          </Link>
        </Button>
      }
      hasFilters={hasFilters}
      resetHref="/admin/lots"
      chips={statusChips}
      errorAlert={
        error || listError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load lots</AlertTitle>
            <AlertDescription>{listError ?? error}</AlertDescription>
          </Alert>
        ) : null
      }
      filters={
        <LotFilterForm
          status={sp.status}
          q={q || undefined}
          viewPipeline={viewPipeline || undefined}
          artistId={artistId || undefined}
          saleId={saleId || undefined}
          categoryId={categoryId || undefined}
          sort={sort}
          artists={artistOptions}
          sales={saleOptions}
          categories={categories}
        />
      }
      view={
        !listError ? (
          <Suspense fallback={<PageSkeleton variant="table" />}>
            <AdminLotsBoard
              rows={lotTableRows}
              fullLots={lotRows}
              viewPipeline={viewPipeline}
              listError={listError}
              urlError={error}
              searchQuery={q}
            />
          </Suspense>
        ) : null
      }
      empty={
        !listError && !viewPipeline && lotRows.length === 0 ? (
          <EmptyState
            title={
              q || statusFilter || artistId || saleId || categoryId
                ? "No matching lots"
                : "No lots yet"
            }
            description={
              q || statusFilter || artistId || saleId || categoryId
                ? "Clear the search or filters to broaden the list."
                : "Create the first draft lot, assign a seller, and prepare it for publication."
            }
            action={
              !q && !statusFilter && !artistId && !saleId && !categoryId ? (
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
        ) : null
      }
      pagination={pagination}
    />
  );
}
