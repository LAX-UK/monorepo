"use client";

import { SaleQuickView } from "@/components/admin/sales/sale-quick-view";
import { type SaleActionTarget, useSaleActions } from "@/components/admin/sales/use-sale-actions";
import { StaffBulkOperations } from "@/components/admin/staff/staff-bulk-operations";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import { getSaleBulkOperations } from "@/lib/admin/bulk-ops/sales";
import { adminSaleDetailTabHref } from "@/lib/admin/catalog-route-helpers";
import {
  SALES_DEFAULT_SORT,
  SALE_DELIVERY_FILTERS,
  type SalesListSearch,
  type SalesStaffRow,
  salePanelHref,
  salesListHref,
  salesSortHref,
  salesSortState,
} from "@/lib/admin/sales/sales-staff-list.vm";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import {
  type AttentionStripItem,
  type DataColumn,
  DataViews,
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
} from "@auction/staff-ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

export type SalesStaffListProps = {
  rows: SalesStaffRow[];
  search: SalesListSearch;
  views: StaffDataView[];
  activeLens: string;
  attention: AttentionStripItem[];
  metrics: Metric[];
  filterChips: Array<{ id: string; label: string; clearHref: string }>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  canManageSales: boolean;
  exportFilters: Record<string, unknown>;
  listError: string | null;
  filtered: boolean;
};

export function saleActionTarget(row: SalesStaffRow): SaleActionTarget {
  return {
    id: row.id,
    title: row.title,
    status: row.statusCode,
    saleroom: row.saleroom,
    canDelete: row.canDelete,
    sellingOnAtg: false,
  };
}

/**
 * Bid's sales on the staff list template: lifecycle views with counts, search, a delivery
 * filter, server sorting by start or newest, bulk publish, cancel and delete for roles that may,
 * and a record panel deep-linked with `?sale=`. Every row's `…` menu holds the sale's actions,
 * each confirmed first.
 */
export function SalesStaffList(props: SalesStaffListProps) {
  const { rows, search } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const panelHref = useCallback((id: string | null) => salePanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "sale",
    initialId: typeof search.sale === "string" ? search.sale : null,
    hrefFor: panelHref,
  });
  const saleActions = useSaleActions({ canManageSales: props.canManageSales });
  const operations = useMemo(
    () => getSaleBulkOperations(props.canManageSales),
    [props.canManageSales],
  );
  const q = typeof search.q === "string" ? search.q : "";
  const delivery = typeof search.delivery === "string" ? search.delivery : "";

  const columns = useMemo<DataColumn<SalesStaffRow>[]>(
    () => [
      {
        id: "sale",
        header: "Sale",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={panelHref(row.id)}
            Link={panel.PanelLink}
            thumbnail={{ src: row.coverImageUrl, missingLabel: "No cover image yet" }}
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
        id: "lots",
        header: "Lots",
        width: "88px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => new Intl.NumberFormat("en-GB").format(row.lotCount),
      },
      {
        id: "starts",
        header: "Starts",
        width: "176px",
        sortable: true,
        defaultSortDirection: "asc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.startsAt} withTime />,
      },
      {
        id: "ends",
        header: "Ends",
        width: "176px",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.endsAt} withTime />,
      },
      {
        id: "added",
        header: "Added",
        width: "120px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "xl",
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
  const openRow = rows.find((row) => row.id === panel.openId) ?? null;

  return (
    <>
      <ListPage<SalesStaffRow>
        title="Sales"
        description="Auction sales. Plan and publish them, follow them live and close them out."
        Link={ListLink}
        listKey="bid-admin.sales"
        editRequires={SALES_ACCESS}
        primaryAction={
          props.canManageSales ? (
            <StaffButton asChild variant="primary" size="sm" icon={<Plus aria-hidden />}>
              <Link href="/admin/sales/new">New sale</Link>
            </StaffButton>
          ) : null
        }
        exportAction={
          <ExportButton
            entityType="sales"
            filters={props.exportFilters}
            className={staffButtonVariants({ variant: "secondary", size: "sm" })}
          />
        }
        attention={props.attention}
        metrics={{ label: "Sales summary", period: "All sales", items: props.metrics }}
        views={<DataViews views={props.views} activeId={props.activeLens} Link={ListLink} />}
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search sales"
            placeholder="Search by sale title"
            value={q}
            onSearch={(next) => navigate(salesListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter sales"
            description="The time window is set by the tabs above the list."
            sections={[
              {
                kind: "radio",
                id: "delivery",
                label: "How it is sold",
                anyLabel: "Any",
                options: SALE_DELIVERY_FILTERS,
                value: delivery,
              },
            ]}
            onApply={(values) =>
              navigate(salesListHref(search, { delivery: (values.delivery as string) || null }))
            }
          />
        }
        activeFilters={activeFilters}
        onClearFilters={() => navigate(salesListHref(search, { q: null, delivery: null }))}
        loading={pending}
        filtered={props.filtered}
        error={
          props.listError
            ? { description: props.listError, onRetry: () => navigate(salesListHref(search, {})) }
            : null
        }
        empty={{
          title: "No sales yet",
          description: "Create a sale to group lots for a session or a season.",
          ...(props.canManageSales
            ? {
                action: (
                  <StaffButton asChild size="sm" variant="primary">
                    <Link href="/admin/sales/new">New sale</Link>
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{ noun: "sales" }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["added"],
          defaultSort: SALES_DEFAULT_SORT,
          sort: salesSortState(typeof search.sort === "string" ? search.sort : undefined),
          onSortChange: (sort) => navigate(salesSortHref(search, sort)),
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: panel.openId,
          ...(props.canManageSales
            ? {
                selectedIds: selected,
                onSelectedIdsChange: setSelected,
                bulkNoun: { one: "sale", other: "sales" },
                bulkActions: (chosen: SalesStaffRow[]) => (
                  <StaffBulkOperations
                    operations={operations}
                    selectedIds={chosen.map((row) => row.id)}
                    onClear={() => setSelected(new Set())}
                    noun={{ one: "sale", other: "sales" }}
                  />
                ),
              }
            : {}),
          rowActions: {
            label: (row) => `Actions for sale ${row.title}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "page", label: "Open sale page", href: row.href },
              { id: "lots", label: "Open lots", href: adminSaleDetailTabHref(row.id, "lots") },
              ...(props.canManageSales && row.editHref
                ? [{ id: "edit", label: "Edit sale", href: row.editHref }]
                : []),
              {
                id: "site",
                label: "View on site",
                onSelect: () => window.open(row.publicHref, "_blank", "noopener,noreferrer"),
              },
              ...saleActions.actionsFor(saleActionTarget(row)),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(salesListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <SaleQuickView
        row={openRow}
        canManageSales={props.canManageSales}
        onClose={() => panel.show(null)}
        actions={openRow ? saleActions.actionsFor(saleActionTarget(openRow)) : []}
      />
      {saleActions.dialogs}
    </>
  );
}
