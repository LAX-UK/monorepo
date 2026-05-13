import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { WatchlistBoard } from "@/components/dashboard/watchlist-board";
import { type WatchlistBoardRow, estimateLabel } from "@/components/dashboard/watchlist-board-rows";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import type { WatchlistWithLotRow } from "@/lib/data/http/dashboard.server";
import type { Category } from "@auction/types";
import { LabelCaps } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Separator } from "@auction/ui/components/separator";
import Link from "next/link";
import { Suspense } from "react";

function toWatchlistRows(rows: WatchlistWithLotRow[]): WatchlistBoardRow[] {
  return rows.flatMap((row) => {
    const lot = row.lot;
    if (!lot) return [];

    return [
      {
        watchlistId: row.watchlistId,
        lotId: lot.id,
        title: lot.title,
        // Stored as the artist ID; resolved to display name by the board via
        // the `artistNameById` lookup map.
        artistLabel: lot.artistId ?? "",
        image: lot.images[0] ?? null,
        medium: lot.medium,
        lotNumber: lot.lotNumber,
        estimateLabel: estimateLabel({
          estimate: lot.marketingDetails.estimate,
          fallback: lot.currentPrice,
        }),
        status: lot.status,
        startTime: lot.startTime.toISOString(),
        endTime: lot.endTime.toISOString(),
      },
    ];
  });
}

type SortOption = "addedDesc" | "endingSoon" | "priceAsc" | "priceDesc";
type StatusFilter = "active" | "scheduled" | "ended";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "addedDesc", label: "Recently added" },
  { value: "endingSoon", label: "Ending soon" },
  { value: "priceAsc", label: "Price low to high" },
  { value: "priceDesc", label: "Price high to low" },
];

function linkWithParams(
  current: { sort: SortOption; status?: StatusFilter; categoryIds: string[] },
  patch: Partial<{ sort: SortOption; status: StatusFilter | null; categoryIds: string[] }>,
) {
  const qs = new URLSearchParams();
  const sort = patch.sort ?? current.sort;
  const status = patch.status === undefined ? current.status : (patch.status ?? undefined);
  const categoryIds = patch.categoryIds ?? current.categoryIds;
  if (sort !== "addedDesc") qs.set("sort", sort);
  if (status) qs.set("status", status);
  if (categoryIds.length > 0) qs.set("categoryIds", categoryIds.join(","));
  const query = qs.toString();
  return query ? `/dashboard/watchlist?${query}` : "/dashboard/watchlist";
}

function parseParams(raw: { sort?: string; status?: string; categoryIds?: string }): {
  sort: SortOption;
  status?: StatusFilter;
  categoryIds: string[];
} {
  const sort = sortOptions.some((option) => option.value === raw.sort)
    ? (raw.sort as SortOption)
    : "addedDesc";
  const status: StatusFilter | undefined =
    raw.status === "active" || raw.status === "scheduled" || raw.status === "ended"
      ? raw.status
      : undefined;
  const categoryIds = raw.categoryIds
    ? raw.categoryIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  return { sort, ...(status ? { status } : {}), categoryIds };
}

export default async function DashboardWatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; status?: string; categoryIds?: string }>;
}) {
  const filters = parseParams(await searchParams);
  const c = await getServerDataContainer();
  const catReader = await getServerCategoryReader();
  let rows: Awaited<ReturnType<typeof c.watchlist.listMine>> = [];
  let categories: Category[] = [];
  let err: string | null = null;

  try {
    [rows, categories] = await Promise.all([c.watchlist.listMine(filters), catReader.list()]);
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load watchlist.";
  }

  const tableRows = toWatchlistRows(rows);
  const artistIds = rows.map((r) => r.lot?.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);

  const chipBase =
    "inline-flex min-h-10 items-center justify-center rounded-full border px-4 font-label text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const chipActive = "border-primary/35 bg-primary-container/45 text-primary shadow-sm";
  const chipIdle =
    "border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:border-primary/25 hover:bg-surface-container-high hover:text-on-surface";

  return (
    <DashboardPage>
      <PageHeader
        title="Watchlist"
        description="Track lots and artists you are following from the saleroom."
        className="border-0 pb-0"
      />

      <DashboardSectionTabs
        ariaLabel="Watchlist sections"
        className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3"
        items={[
          { href: "/dashboard/watchlist", label: "Lots", isActive: true },
          { href: "/dashboard/artist-follow", label: "Artists" },
        ]}
      />

      <div className="space-y-5 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm">
        <div className="space-y-2">
          <LabelCaps className="text-on-surface-variant">Sort</LabelCaps>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <Link
                key={option.value}
                href={linkWithParams(filters, { sort: option.value })}
                className={`${chipBase} ${filters.sort === option.value ? chipActive : chipIdle}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        <Separator className="bg-outline-variant/15" />

        <div className="space-y-2">
          <LabelCaps className="text-on-surface-variant">Status</LabelCaps>
          <div className="flex flex-wrap gap-2">
            {(["active", "scheduled", "ended"] as StatusFilter[]).map((status) => (
              <Link
                key={status}
                href={linkWithParams(filters, {
                  status: filters.status === status ? null : status,
                })}
                className={`${chipBase} capitalize ${filters.status === status ? chipActive : chipIdle}`}
              >
                {status}
              </Link>
            ))}
          </div>
        </div>

        {categories.length > 0 ? (
          <>
            <Separator className="bg-outline-variant/15" />
            <div className="space-y-2">
              <LabelCaps className="text-on-surface-variant">Category</LabelCaps>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const active = filters.categoryIds.includes(category.id);
                  const nextCategoryIds = active
                    ? filters.categoryIds.filter((id) => id !== category.id)
                    : [...filters.categoryIds, category.id];
                  return (
                    <Link
                      key={category.id}
                      href={linkWithParams(filters, { categoryIds: nextCategoryIds })}
                      className={`${chipBase} ${active ? chipActive : chipIdle}`}
                    >
                      {category.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {err ? (
        <Alert variant="destructive" className="rounded-xl border-error/40 shadow-sm">
          <AlertTitle>Could not load watchlist</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {!err && tableRows.length === 0 ? (
        <EmptyState
          title="No watched lots yet"
          description="Save lots from artwork pages to monitor their status and closing time here."
          action={
            <Button variant="default" asChild>
              <Link href="/">Browse auctions</Link>
            </Button>
          }
        />
      ) : null}

      {!err && tableRows.length > 0 ? (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <WatchlistBoard rows={tableRows} artistNameById={artistNameById} />
        </Suspense>
      ) : null}
    </DashboardPage>
  );
}
