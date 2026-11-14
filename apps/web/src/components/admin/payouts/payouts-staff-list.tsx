"use client";

import { usePayoutMoneyActions } from "@/components/admin/payouts/payout-money-actions";
import { PayoutQuickView } from "@/components/admin/payouts/payout-quick-view";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import {
  PAYOUTS_DEFAULT_SORT,
  type PayoutsListSearch,
  type PayoutsStaffRow,
  type PayoutsViewId,
  payoutPanelHref,
  payoutsAttention,
  payoutsFilterChips,
  payoutsListHref,
  payoutsMetrics,
  payoutsSortHref,
  payoutsViews,
} from "@/lib/admin/finance/payouts-staff-list.vm";
import type { AdminPayoutListSummary } from "@/lib/data/http/admin-payouts.shared";
import type { PayoutSalesDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import {
  CellLink,
  type DataColumn,
  DataViews,
  ListPage,
  PrimaryCell,
  type SortState,
  StaffButton,
  StaffDate,
  StatusBadge,
  TableSearch,
  staffButtonVariants,
  useQueuePanel,
} from "@auction/staff-ui";
import Link from "next/link";
import { useCallback, useMemo } from "react";

export type PayoutsStaffListProps = {
  search: PayoutsListSearch;
  view: PayoutsViewId;
  /** The sort in the URL; the server has already put the rows in this order. */
  sort: SortState;
  rows: PayoutsStaffRow[];
  /** The payout a `?payout=` link names when it is not among `rows`, so its panel still opens. */
  openOffPage?: PayoutsStaffRow | null;
  summary: AdminPayoutListSummary;
  disputesOpen: number;
  capabilities: { canProcess: boolean; canReverse: boolean };
  sellerFilterName: string | null;
  exportFilters: Record<string, unknown>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
  /** Reads a payout's sale lines for its panel. */
  loadSales?: (payoutId: string) => Promise<PayoutSalesDto | null>;
  /** For the review route: open with this payout's sale lines. */
  initialSales?: PayoutSalesDto;
};

/**
 * Bid's seller payouts on the staff list template: status views, a summary of the matching
 * payouts, the work waiting on finance, and mark paid, adjustment and reversal from each row's
 * `…` menu or the record panel, always through a confirm dialog with the amount and the seller.
 *
 * Finance works through payouts one after another, so a row opens a queue panel: the payout is in
 * the URL (`?payout=`), the panel shows its place ("3 of 12") and J and K step through the rows as
 * they are sorted, Back closes it and Esc returns to the row. A payout has no page of its own yet,
 * so a new tab opens the list with that payout's panel.
 */
export function PayoutsStaffList(props: PayoutsStaffListProps) {
  const { search, rows, capabilities } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback((id: string | null) => payoutPanelHref(search, id), [search]);
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const panel = useQueuePanel({
    param: "payout",
    ids,
    initialId: typeof search.payout === "string" && search.payout ? search.payout : null,
    noun: "payout",
    hrefFor: panelHref,
  });
  const money = usePayoutMoneyActions(capabilities);
  const q = typeof search.q === "string" ? search.q : "";
  const filtered = Boolean(search.status || search.legalEntityId || q);

  const columns = useMemo<DataColumn<PayoutsStaffRow>[]>(
    () => [
      {
        id: "period",
        header: "Period",
        mobile: "title",
        sortable: true,
        defaultSortDirection: "desc",
        cell: (row) => (
          <PrimaryCell href={panelHref(row.id)} Link={Link}>
            {row.period}
          </PrimaryCell>
        ),
      },
      {
        id: "reference",
        header: "Reference",
        width: "190px",
        mobile: "meta",
        cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
      },
      {
        id: "status",
        header: "Status",
        width: "168px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <StatusBadge
            tone={row.statusPresentation.tone}
            live={row.statusPresentation.live ?? false}
          >
            {row.statusPresentation.label}
          </StatusBadge>
        ),
      },
      {
        id: "seller",
        header: "Seller",
        width: "24%",
        mobile: "meta",
        cell: (row) => (
          <CellLink
            href={`/admin/legal-entities/${encodeURIComponent(row.legalEntityId)}`}
            Link={Link}
          >
            {row.seller}
          </CellLink>
        ),
      },
      {
        id: "hammer",
        header: "Hammer",
        width: "128px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) =>
          row.oldRule ? <span className="text-staff-muted">Old rule</span> : row.hammer,
      },
      {
        id: "net",
        header: "Net",
        width: "128px",
        numeric: true,
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.net,
      },
      {
        id: "transfer",
        header: "Stripe transfer",
        width: "184px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => row.stripeTransferId,
      },
      {
        id: "paid",
        header: "Paid",
        width: "120px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.paidAt} />,
      },
    ],
    [panelHref],
  );

  const activeFilters = payoutsFilterChips(search, props.sellerFilterName).map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  const openRow =
    rows.find((row) => row.id === panel.openId) ??
    (props.openOffPage && props.openOffPage.id === panel.openId ? props.openOffPage : null);

  return (
    <>
      <ListPage<PayoutsStaffRow>
        title="Payouts"
        description="Seller payouts. Run settlement, add adjustments, mark transfers as paid and reverse payouts."
        Link={ListLink}
        listKey="bid-admin.payouts"
        access={capabilities.canProcess || capabilities.canReverse ? "full" : "read-only"}
        primaryAction={
          capabilities.canProcess ? (
            <StaffButton asChild variant="primary" size="sm">
              <Link href="/admin/payouts/settlement">Run settlement</Link>
            </StaffButton>
          ) : null
        }
        exportAction={
          <ExportButton
            entityType="payouts"
            filters={props.exportFilters}
            className={staffButtonVariants({ variant: "secondary", size: "sm" })}
          />
        }
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search payouts"
            placeholder="Search by reference (PO-2026-3FA9C1D2) or payout id"
            value={q}
            onSearch={(next) => navigate(payoutsListHref(search, { q: next || null }))}
          />
        }
        attention={payoutsAttention(search, props.summary, props.disputesOpen)}
        metrics={{
          label: "Payouts summary",
          period: filtered ? "Payouts matching this view and filters" : "All payouts",
          items: payoutsMetrics(props.summary),
        }}
        views={<DataViews views={payoutsViews(search)} activeId={props.view} Link={ListLink} />}
        activeFilters={activeFilters}
        onClearFilters={() => navigate(payoutsListHref(search, { legalEntityId: null }))}
        loading={pending}
        filtered={filtered}
        error={
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(payoutsListHref(search, {})),
              }
            : null
        }
        empty={{
          title: "No payouts yet",
          description: "Payouts appear here when a settlement is run for a seller.",
        }}
        noResults={{ noun: "payouts" }}
        table={{
          label: "Payouts",
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultSort: PAYOUTS_DEFAULT_SORT,
          sort: props.sort,
          onSortChange: (sort) => navigate(payoutsSortHref(search, sort)),
          defaultHiddenColumns: ["transfer"],
          // The table takes over a plain click, the title link and Enter to open the queue panel;
          // a new tab (Cmd or Ctrl, the middle button) opens the list with that payout open.
          onRowOpen: (row) => panel.open(row.id),
          rowHref: (row) => panelHref(row.id),
          activeRowId: panel.openId,
          rowActions: {
            label: (row) => `Actions for payout to ${row.seller}, ${row.period}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.open(row.id) },
              {
                id: "seller",
                label: "Open seller",
                href: `/admin/legal-entities/${encodeURIComponent(row.legalEntityId)}`,
              },
              ...money.actionsFor(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(payoutsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <PayoutQuickView
        row={openRow}
        canProcess={capabilities.canProcess}
        canReverse={capabilities.canReverse}
        onOpenChange={panel.onOpenChange}
        queue={panel.queue}
        onMarkPaid={money.markPaid}
        onAdjust={money.adjust}
        onRetryTransfer={money.retryTransfer}
        onAdoptBlocked={money.adoptBlocked}
        onReleaseBlocked={money.releaseBlocked}
        onReverse={money.reverse}
        moneyActions={openRow ? money.actionsFor(openRow) : []}
        {...(props.loadSales ? { loadSales: props.loadSales } : {})}
        {...(props.initialSales ? { initialSales: props.initialSales } : {})}
      />
      {money.dialogs}
    </>
  );
}
