"use client";

import { LotQuickView } from "@/components/admin/lots/lot-quick-view";
import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import { getLotBulkOperations } from "@/lib/admin/bulk-ops/lots";
import type { CatalogSegmentItem } from "@/lib/admin/catalog/types";
import {
  LOT_STATUS_FILTERS,
  type LotsListSearch,
  type LotsStaffRow,
  lotsListHref,
  lotsSortHref,
  lotsSortState,
  lotsTeamViews,
} from "@/lib/admin/lots/lots-staff-list.vm";
import { createSavedViewsPort } from "@/lib/admin/saved-views-port";
import {
  ActiveFilterChips,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DataViews,
  DensityToggle,
  EmptyState,
  ErrorState,
  FilterMenu,
  NoResultsState,
  StaffButton,
  StatusBadge,
  TablePagination,
  TableSearch,
  formatStaffDateTime,
  useSavedViews,
  useTableDensity,
} from "@auction/staff-ui";
import { ImageOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type LotsStaffListProps = {
  rows: LotsStaffRow[];
  search: LotsListSearch;
  lenses: CatalogSegmentItem[];
  activeLens: string;
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  sales: Array<{ id: string; title: string }>;
  artists: Array<{ id: string; displayName: string }>;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  canManageCatalog: boolean;
  canManageAuction: boolean;
  exportFilters: Record<string, unknown>;
  listError: string | null;
  filtered: boolean;
};

function Thumbnail({ url, title }: { url: string | null; title: string }) {
  return url ? (
    <img
      src={url}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      className="size-8 shrink-0 rounded-staff-xs border border-staff-line object-cover"
      title={title}
    />
  ) : (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-staff-xs border border-dashed border-staff-line-strong text-staff-subtle [&_svg]:size-3.5"
    >
      <ImageOff />
    </span>
  );
}

/**
 * Bid's lots in the staff kit: lenses as views with counts, saved views, search, status, sale and
 * artist filters, server sorting, bulk publish/cancel/delete (for roles that may) and a quick
 * view beside the list. Every filter is a URL.
 */
export function LotsStaffList(props: LotsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [density, setDensity] = useTableDensity("bid-lots");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const port = useMemo(() => createSavedViewsPort("bid-admin.lots"), []);
  const saved = useSavedViews("bid-admin.lots", port, { legacyStorageKey: "staff.views.bid-lots" });
  const teamViews = useMemo(() => lotsTeamViews(), []);
  const currentQuery = lotsListHref(search, {}).split("?")[1] ?? "";
  const status = typeof search.status === "string" ? search.status : "";
  const saleId = typeof search.saleId === "string" ? search.saleId : "";
  const artistId = typeof search.artistId === "string" ? search.artistId : "";
  const operations = useMemo(
    () => (props.canManageCatalog ? getLotBulkOperations(props.canManageAuction) : []),
    [props.canManageCatalog, props.canManageAuction],
  );

  const columns: DataColumn<LotsStaffRow>[] = [
    {
      id: "lot",
      header: "Lot",
      mobile: "title",
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-3">
          <Thumbnail url={row.thumbnailUrl} title={row.title} />
          <span className="flex min-w-0 flex-col">
            <Link
              href={row.href}
              className="staff-focus truncate rounded-staff-xs font-medium text-staff-fg hover:underline"
            >
              {row.title}
            </Link>
            <span className="truncate text-staff-xs text-staff-muted">
              {[row.lotNumber != null ? `Lot ${row.lotNumber}` : null, row.artist]
                .filter(Boolean)
                .join(" · ") || "Unassigned"}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "sale",
      header: "Sale",
      width: "22%",
      hideBelow: "lg",
      mobile: "meta",
      cell: (row) =>
        row.saleHref && row.saleTitle ? (
          <Link
            href={row.saleHref}
            className="staff-focus truncate rounded-staff-xs text-staff-muted hover:text-staff-fg hover:underline"
          >
            {row.saleTitle}
          </Link>
        ) : (
          <span className="text-staff-subtle">No sale</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      width: "128px",
      mobile: "badge",
      cell: (row) => (
        <StatusBadge tone={row.status.tone} live={row.status.live ?? false}>
          {row.status.label}
        </StatusBadge>
      ),
    },
    {
      id: "estimate",
      header: "Estimate",
      width: "152px",
      numeric: true,
      hideBelow: "xl",
      cell: (row) => <span className="text-staff-muted">{row.estimate}</span>,
    },
    {
      id: "hammer",
      header: "Hammer",
      width: "112px",
      numeric: true,
      sortable: true,
      mobile: "meta",
      cell: (row) => row.hammer,
    },
    {
      id: "ends",
      header: "Ends",
      width: "168px",
      numeric: true,
      sortable: true,
      hideBelow: "md",
      mobile: "meta",
      cell: (row) => (
        <time dateTime={row.endsAt} className="text-staff-muted">
          {formatStaffDateTime(row.endsAt)}
        </time>
      ),
    },
  ];

  const views = [
    ...props.lenses.map((lens) => ({
      id: lens.id,
      label: lens.label,
      href: lens.href,
      ...(lens.badge !== undefined ? { count: lens.badge } : {}),
    })),
  ];
  const pick = (values: string[], current: string) =>
    values.find((value) => value !== current) ?? "";

  return (
    <>
      <DataTable
        label="Lots"
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        density={density}
        loading={pending}
        onRowOpen={(row) => setOpenId(row.id)}
        activeRowId={openId}
        sort={lotsSortState(typeof search.sort === "string" ? search.sort : undefined)}
        onSortChange={(sort) => navigate(lotsSortHref(search, sort))}
        {...(operations.length > 0
          ? {
              selectedIds: selected,
              onSelectedIdsChange: setSelected,
              bulkNoun: { one: "lot", other: "lots" },
              bulkActions: (chosen: LotsStaffRow[]) => (
                <StaffBulkOperations
                  operations={operations}
                  selectedIds={chosen.map((row) => row.id)}
                  onClear={() => setSelected(new Set())}
                  noun={{ one: "lot", other: "lots" }}
                />
              ),
            }
          : {})}
        toolbar={
          <DataTableToolbar
            views={
              <DataViews
                views={views}
                activeId={props.activeLens}
                Link={ListLink}
                team={teamViews}
                saved={saved}
                savedHref={(view) => `/admin/lots?${view.query}`}
                currentQuery={currentQuery}
              />
            }
            search={
              <TableSearch
                key={typeof search.q === "string" ? search.q : ""}
                label="Search lots"
                placeholder="Title, lot number or artist"
                value={typeof search.q === "string" ? search.q : ""}
                onSearch={(q) => navigate(lotsListHref(search, { q: q || null }))}
              />
            }
            filters={
              <>
                <FilterMenu
                  label="Status"
                  options={LOT_STATUS_FILTERS}
                  selected={status ? [status] : []}
                  onChange={(values) =>
                    navigate(
                      lotsListHref(search, { status: pick(values, status) || null, lens: null }),
                    )
                  }
                />
                <FilterMenu
                  label="Sale"
                  options={props.sales.map((sale) => ({ value: sale.id, label: sale.title }))}
                  selected={saleId ? [saleId] : []}
                  onChange={(values) =>
                    navigate(lotsListHref(search, { saleId: pick(values, saleId) || null }))
                  }
                />
                <FilterMenu
                  label="Artist"
                  options={props.artists.map((artist) => ({
                    value: artist.id,
                    label: artist.displayName,
                  }))}
                  selected={artistId ? [artistId] : []}
                  onChange={(values) =>
                    navigate(lotsListHref(search, { artistId: pick(values, artistId) || null }))
                  }
                />
              </>
            }
            activeFilters={
              <ActiveFilterChips
                filters={props.filterChips.map((chip) => ({
                  id: chip.id,
                  label: chip.label,
                  onRemove: () => navigate(chip.clearHref),
                }))}
                onClearAll={() => navigate("/admin/lots")}
              />
            }
            end={
              <>
                <ExportButton entityType="lots" filters={props.exportFilters} />
                <DensityToggle value={density} onChange={setDensity} />
              </>
            }
          />
        }
        error={
          props.listError ? (
            <ErrorState
              title="Lots did not load"
              description={props.listError}
              action={
                <StaffButton size="sm" onClick={() => navigate(lotsListHref(search, {}))}>
                  Try again
                </StaffButton>
              }
            />
          ) : undefined
        }
        empty={
          filtered ? (
            <NoResultsState
              title="No lots in this view"
              description="Try another view, or clear the search and filters."
              action={
                <StaffButton size="sm" onClick={() => navigate("/admin/lots")}>
                  Clear filters
                </StaffButton>
              }
            />
          ) : (
            <EmptyState
              title="No lots yet"
              description="Create the first draft lot and assign a seller."
              {...(props.canManageCatalog
                ? {
                    action: (
                      <StaffButton asChild size="sm" variant="primary">
                        <Link href="/admin/lots/new">New lot</Link>
                      </StaffButton>
                    ),
                  }
                : {})}
            />
          )
        }
        footer={
          props.pagination ? (
            <TablePagination
              summary={props.pagination.summary}
              prevHref={props.pagination.prevHref}
              nextHref={props.pagination.nextHref}
              Link={ListLink}
            />
          ) : null
        }
      />
      <LotQuickView
        row={rows.find((row) => row.id === openId) ?? null}
        canManageCatalog={props.canManageCatalog}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
