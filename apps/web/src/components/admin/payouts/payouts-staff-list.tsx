"use client";

import { usePayoutMoneyActions } from "@/components/admin/payouts/payout-money-actions";
import { PayoutQuickView } from "@/components/admin/payouts/payout-quick-view";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import {
  type PayoutsListSearch,
  type PayoutsStaffRow,
  type PayoutsViewId,
  payoutPanelHref,
  payoutsAttention,
  payoutsFilterChips,
  payoutsListHref,
  payoutsMetrics,
  payoutsViews,
} from "@/lib/admin/finance/payouts-staff-list.vm";
import type { AdminPayoutListSummary } from "@/lib/data/http/admin-payouts.shared";
import {
  CellLink,
  type DataColumn,
  DataViews,
  ListPage,
  PrimaryCell,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  staffButtonVariants,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo, useState } from "react";

export type PayoutsStaffListProps = {
  search: PayoutsListSearch;
  view: PayoutsViewId;
  rows: PayoutsStaffRow[];
  summary: AdminPayoutListSummary;
  disputesOpen: number;
  capabilities: { canProcess: boolean; canReverse: boolean };
  sellerFilterName: string | null;
  exportFilters: Record<string, unknown>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Bid's seller payouts on the staff list template: status views, a summary of the matching
 * payouts, the work waiting on finance, and mark paid, adjustment and reversal from each row's
 * `…` menu or the record panel, always through a confirm dialog with the amount and the seller.
 * The panel is deep-linkable with `?payout=`.
 */
export function PayoutsStaffList(props: PayoutsStaffListProps) {
  const { search, rows, capabilities } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(
    typeof search.payout === "string" && search.payout ? search.payout : null,
  );
  const money = usePayoutMoneyActions(capabilities);
  const filtered = Boolean(search.status || search.legalEntityId);

  // The panel opens and closes without asking the server for the list again; the URL follows.
  const showPanel = (id: string | null) => {
    setOpenId(id);
    window.history.replaceState(null, "", payoutPanelHref(search, id));
  };

  const PanelLink = useMemo<StaffLinkComponent>(
    () =>
      function PanelLink({ href, onClick, children, prefetch: _prefetch, ...rest }) {
        return (
          <a
            href={href}
            {...rest}
            onClick={(event) => {
              onClick?.(event);
              const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
              if (event.defaultPrevented || event.button !== 0 || modified) return;
              const id = new URL(href, "http://staff.local").searchParams.get("payout");
              if (!id) return;
              event.preventDefault();
              setOpenId(id);
              window.history.replaceState(null, "", href);
            }}
          >
            {children}
          </a>
        );
      },
    [],
  );

  const columns = useMemo<DataColumn<PayoutsStaffRow>[]>(
    () => [
      {
        id: "period",
        header: "Period",
        mobile: "title",
        sortable: true,
        sortValue: (row) => row.periodStart,
        defaultSortDirection: "desc",
        cell: (row) => (
          <PrimaryCell href={payoutPanelHref(search, row.id)} Link={PanelLink}>
            {row.period}
          </PrimaryCell>
        ),
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
        id: "gross",
        header: "Gross",
        width: "128px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.gross,
      },
      {
        id: "net",
        header: "Net",
        width: "128px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.netPence,
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
        sortValue: (row) => row.paidAt,
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.paidAt} />,
      },
    ],
    [search, PanelLink],
  );

  const activeFilters = payoutsFilterChips(search, props.sellerFilterName).map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  const openRow = rows.find((row) => row.id === openId) ?? null;

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
          defaultSort: { columnId: "period", direction: "desc" },
          defaultHiddenColumns: ["transfer"],
          onRowOpen: (row) => showPanel(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for payout to ${row.seller}, ${row.period}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => showPanel(row.id) },
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
        onClose={() => showPanel(null)}
        onMarkPaid={money.markPaid}
        onAdjust={money.adjust}
        onRetryTransfer={money.retryTransfer}
        onReverse={money.reverse}
        moneyActions={openRow ? money.actionsFor(openRow) : []}
      />
      {money.dialogs}
    </>
  );
}
