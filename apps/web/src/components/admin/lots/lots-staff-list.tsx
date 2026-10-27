"use client";

import { LotQuickView } from "@/components/admin/lots/lot-quick-view";
import { type LotActionTarget, useLotActions } from "@/components/admin/lots/use-lot-actions";
import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import { getLotBulkOperations } from "@/lib/admin/bulk-ops/lots";
import {
  LOTS_DEFAULT_SORT,
  LOT_STATUS_FILTERS,
  type LotsListSearch,
  type LotsStaffRow,
  lotPanelHref,
  lotsListHref,
  lotsSortHref,
  lotsSortState,
  lotsTeamViews,
} from "@/lib/admin/lots/lots-staff-list.vm";
import { createSavedViewsPort } from "@/lib/admin/saved-views-port";
import {
  type AttentionStripItem,
  CellLink,
  type DataColumn,
  DataViews,
  type EntityOption,
  FilterSheet,
  ListPage,
  type Metric,
  PrimaryCell,
  StaffButton,
  type DataView as StaffDataView,
  StaffDate,
  StatusBadge,
  TableSearch,
  staffButtonVariants,
  useSavedViews,
} from "@auction/staff-ui";
import { Clock, FilePen, Gavel, Radio } from "@auction/staff-ui/icons";
import { Plus } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useMemo, useState } from "react";

const LOT_METRIC_ICONS: Record<string, ReactNode> = {
  live: <Radio />,
  ending: <Clock />,
  draft: <FilePen />,
  hammer: <Gavel />,
};

export type LotsStaffListProps = {
  rows: LotsStaffRow[];
  search: LotsListSearch;
  views: StaffDataView[];
  activeLens: string;
  attention: AttentionStripItem[];
  metrics: Metric[];
  /** What the metrics cover: "All lots · hammer trend over the last 30 days". */
  metricsPeriod: string;
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  filterOptions: {
    sales: EntityOption[];
    artists: EntityOption[];
    categories: EntityOption[];
  };
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  canManageCatalog: boolean;
  canManageAuction: boolean;
  canDecideWithdrawals: boolean;
  exportFilters: Record<string, unknown>;
  listError: string | null;
  filtered: boolean;
};

/** The row as the lot actions see it. */
export function lotActionTarget(row: LotsStaffRow): LotActionTarget {
  return {
    id: row.id,
    title: row.title,
    status: row.statusCode,
    inDraftSale: row.inDraftSale,
    canDelete: row.canDelete,
    hasWinner: row.hasWinner,
    withdrawalRequested: row.withdrawalRequestedAt !== null,
  };
}

/**
 * Bid's lots on the staff list template: lenses (and the seller withdrawal requests) as views
 * with counts, saved and team views, search, a filter sheet for status, sale, artist and
 * category, server sorting, bulk publish, withdraw and delete for roles that may, and a record
 * panel deep-linked with `?lot=`. Every row's `…` menu holds the lot's actions, each confirmed
 * first.
 */
export function LotsStaffList(props: LotsStaffListProps) {
  const { rows, search, filtered } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const panelHref = useCallback((id: string | null) => lotPanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "lot",
    initialId: typeof search.lot === "string" ? search.lot : null,
    hrefFor: panelHref,
  });
  const lotActions = useLotActions({
    canManageCatalog: props.canManageCatalog,
    canManageAuction: props.canManageAuction,
    canDecideWithdrawals: props.canDecideWithdrawals,
  });
  const port = useMemo(() => createSavedViewsPort("bid-admin.lots"), []);
  const saved = useSavedViews("bid-admin.lots", port, { legacyStorageKey: "staff.views.bid-lots" });
  const teamViews = useMemo(() => lotsTeamViews(), []);
  const currentQuery = lotsListHref(search, {}).split("?")[1] ?? "";
  const q = typeof search.q === "string" ? search.q : "";
  const status = typeof search.status === "string" ? search.status : "";
  const saleId = typeof search.saleId === "string" ? search.saleId : "";
  const artistId = typeof search.artistId === "string" ? search.artistId : "";
  const categoryId = typeof search.categoryId === "string" ? search.categoryId : "";
  const operations = useMemo(
    () => (props.canManageCatalog ? getLotBulkOperations(props.canManageAuction) : []),
    [props.canManageCatalog, props.canManageAuction],
  );

  const columns = useMemo<DataColumn<LotsStaffRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={panelHref(row.id)}
            Link={panel.PanelLink}
            thumbnail={{ src: row.thumbnailUrl, missingLabel: "No photos yet" }}
            secondary={row.context}
          >
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "132px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <StatusBadge tone={row.status.tone} live={row.status.live ?? false}>
            {row.status.label}
          </StatusBadge>
        ),
      },
      {
        id: "sale",
        header: "Sale",
        width: "17%",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) =>
          row.saleHref && row.saleTitle ? (
            <CellLink href={row.saleHref} Link={Link}>
              {row.saleTitle}
            </CellLink>
          ) : null,
      },
      {
        id: "estimate",
        header: "Estimate",
        width: "148px",
        numeric: true,
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => row.estimate,
      },
      {
        id: "hammer",
        header: "Hammer",
        width: "112px",
        numeric: true,
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.hammer,
      },
      {
        id: "ends",
        header: "Ends",
        width: "172px",
        sortable: true,
        defaultSortDirection: "asc",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.endsAt} withTime />,
      },
      {
        id: "added",
        header: "Added",
        width: "120px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.addedAt} />,
      },
    ],
    [panelHref, panel.PanelLink],
  );

  const activeFilters = props.filterChips.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  const clearHref = lotsListHref(search, {
    q: null,
    status: null,
    saleId: null,
    artistId: null,
    categoryId: null,
    sort: null,
  });
  const openRow = rows.find((row) => row.id === panel.openId) ?? null;
  const access = props.canManageCatalog || props.canManageAuction ? "full" : "read-only";

  return (
    <>
      <ListPage<LotsStaffRow>
        title="Lots"
        description="Catalogue lots. Publish, schedule and withdraw them, and decide sellers' withdrawal requests."
        Link={ListLink}
        listKey="bid-admin.lots"
        access={access}
        roleLabel="Catalogue"
        primaryAction={
          props.canManageCatalog ? (
            <StaffButton asChild variant="primary" size="sm" icon={<Plus aria-hidden />}>
              <Link href="/admin/lots/new">New lot</Link>
            </StaffButton>
          ) : null
        }
        exportAction={
          <ExportButton
            entityType="lots"
            filters={props.exportFilters}
            className={staffButtonVariants({ variant: "secondary", size: "sm" })}
          />
        }
        attention={props.attention}
        metrics={{
          label: "Lots summary",
          period: props.metricsPeriod,
          items: props.metrics.map((metric) => ({ ...metric, icon: LOT_METRIC_ICONS[metric.id] })),
        }}
        views={
          <DataViews
            views={props.views}
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
            key={q}
            fullWidth
            label="Search lots"
            placeholder="Search by title, lot number or artist"
            value={q}
            onSearch={(next) => navigate(lotsListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter lots"
            sections={[
              {
                kind: "radio",
                id: "status",
                label: "Status",
                anyLabel: "Any status",
                options: LOT_STATUS_FILTERS,
                value: status,
              },
              {
                kind: "entity",
                id: "saleId",
                label: "Sale",
                value: saleId,
                options: props.filterOptions.sales,
                placeholder: "Any sale",
                searchPlaceholder: "Search sales",
                emptyText: "No sales match.",
              },
              {
                kind: "entity",
                id: "artistId",
                label: "Artist",
                value: artistId,
                options: props.filterOptions.artists,
                placeholder: "Any artist",
                searchPlaceholder: "Search artists",
                emptyText: "No artists match.",
              },
              {
                kind: "entity",
                id: "categoryId",
                label: "Category",
                value: categoryId,
                options: props.filterOptions.categories,
                placeholder: "Any category",
                searchPlaceholder: "Search categories",
                emptyText: "No categories match.",
              },
            ]}
            onApply={(values) => {
              const nextStatus = (values.status as string) || null;
              navigate(
                lotsListHref(search, {
                  status: nextStatus,
                  // A status chosen here replaces the view tab's own status.
                  ...(nextStatus !== (status || null) ? { lens: null, needsPhotos: null } : {}),
                  saleId: (values.saleId as string) || null,
                  artistId: (values.artistId as string) || null,
                  categoryId: (values.categoryId as string) || null,
                }),
              );
            }}
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(clearHref)}
        loading={pending}
        filtered={filtered}
        error={
          props.listError
            ? { description: props.listError, onRetry: () => navigate(lotsListHref(search, {})) }
            : null
        }
        empty={{
          title: props.activeLens === "withdrawals" ? "No withdrawal requests" : "No lots yet",
          description:
            props.activeLens === "withdrawals"
              ? "When a seller asks to withdraw a lot, the lot appears here for a decision."
              : "Create the first draft lot, then add its photos and assign a seller.",
          ...(props.canManageCatalog && props.activeLens !== "withdrawals"
            ? {
                action: (
                  <StaffButton asChild size="sm" variant="primary">
                    <Link href="/admin/lots/new">New lot</Link>
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{ noun: "lots" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // The lot cell has a photo and a second line, which need 44px rows.
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["added"],
          defaultSort: LOTS_DEFAULT_SORT,
          sort: lotsSortState(typeof search.sort === "string" ? search.sort : undefined),
          onSortChange: (sort) => navigate(lotsSortHref(search, sort)),
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          ...(operations.length > 0
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
            : {}),
          rowActions: {
            label: (row) => `Actions for lot ${row.title}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "page", label: "Open lot page", href: row.href },
              ...(props.canManageCatalog
                ? [{ id: "edit", label: "Edit lot", href: row.editHref }]
                : []),
              ...(row.saleHref ? [{ id: "sale", label: "Open sale", href: row.saleHref }] : []),
              ...lotActions.actionsFor(lotActionTarget(row)),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(lotsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <LotQuickView
        row={openRow}
        canManageCatalog={props.canManageCatalog}
        onClose={() => panel.show(null)}
        actions={openRow ? lotActions.actionsFor(lotActionTarget(openRow)) : []}
      />
      {lotActions.dialogs}
    </>
  );
}
