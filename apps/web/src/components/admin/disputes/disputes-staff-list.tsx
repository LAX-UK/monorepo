"use client";

import {
  DisputeQuickView,
  disputeLinkActions,
  disputePaymentHref,
} from "@/components/admin/disputes/dispute-quick-view";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  type DisputesListSearch,
  type DisputesStaffRow,
  type DisputesViewId,
  disputePanelHref,
  disputesAttention,
  disputesListHref,
  disputesMetrics,
  disputesViews,
} from "@/lib/admin/finance/disputes-staff-list.vm";
import {
  CellLink,
  type DataColumn,
  DataViews,
  ListPage,
  PrimaryCell,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import type { AdminDisputeCaseSummary } from "@auction/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export type DisputesStaffListProps = {
  search: DisputesListSearch;
  view: DisputesViewId;
  rows: DisputesStaffRow[];
  summary: AdminDisputeCaseSummary;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Bid's card disputes on the staff list template: status views, the queue's summary, and a record
 * panel with the case's facts and what Stripe reported. Disputes are answered in Stripe, so the
 * row `…` menu only links to the payment, lot and people involved. The panel opens with `?dispute=`.
 */
export function DisputesStaffList(props: DisputesStaffListProps) {
  const { search, rows } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(
    typeof search.dispute === "string" && search.dispute ? search.dispute : null,
  );
  const filtered = props.view !== "all";

  // The panel opens and closes without asking the server for the list again; the URL follows.
  const showPanel = (id: string | null) => {
    setOpenId(id);
    window.history.replaceState(null, "", disputePanelHref(search, id));
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
              const id = new URL(href, "http://staff.local").searchParams.get("dispute");
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

  const columns = useMemo<DataColumn<DisputesStaffRow>[]>(
    () => [
      {
        id: "case",
        header: "Dispute",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={disputePanelHref(search, row.id)}
            Link={PanelLink}
            secondary={row.reason}
          >
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "144px",
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
        width: "22%",
        mobile: "meta",
        cell: (row) => (
          <CellLink href={`/admin/legal-entities/${encodeURIComponent(row.sellerId)}`} Link={Link}>
            {row.seller}
          </CellLink>
        ),
      },
      {
        id: "buyer",
        header: "Buyer",
        width: "20%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) =>
          row.buyerId && row.buyer ? (
            <CellLink href={`/admin/clients/${encodeURIComponent(row.buyerId)}`} Link={Link}>
              {row.buyer}
            </CellLink>
          ) : null,
      },
      {
        id: "amount",
        header: "Amount",
        width: "128px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.amountCents,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.amount,
      },
      {
        id: "opened",
        header: "Opened",
        width: "120px",
        sortable: true,
        sortValue: (row) => row.openedAt,
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.openedAt} />,
      },
    ],
    [search, PanelLink],
  );

  const openRow = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      <ListPage<DisputesStaffRow>
        title="Disputes"
        description="Card disputes raised through Stripe. Open one for its facts and history, then follow it to the payment."
        Link={ListLink}
        listKey="bid-admin.disputes"
        attention={disputesAttention(search, props.summary, props.view)}
        metrics={{
          label: "Disputes summary",
          period: "All disputes, whatever the view",
          items: disputesMetrics(props.summary),
        }}
        views={
          <DataViews
            views={disputesViews(search, props.summary)}
            activeId={props.view}
            Link={ListLink}
          />
        }
        loading={pending}
        filtered={filtered}
        onClearFilters={() => navigate(disputesListHref(search, { status: null }))}
        error={
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(disputesListHref(search, {})),
              }
            : null
        }
        empty={{
          title: "No disputes",
          description: "Disputes appear here when a buyer challenges a card payment.",
        }}
        noResults={{
          title: "No disputes in this view",
          description: "Try another view, or look at all disputes.",
        }}
        table={{
          label: "Disputes",
          columns,
          data: rows,
          getRowId: (row) => row.id,
          // The first cell carries a second line, which needs 44px rows.
          defaultDensity: "comfortable",
          defaultSort: { columnId: "opened", direction: "desc" },
          onRowOpen: (row) => showPanel(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for dispute ${row.title}, ${row.reason}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => showPanel(row.id) },
              { id: "payment", label: "Open payment", href: disputePaymentHref(row) },
              ...disputeLinkActions(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(disputesListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <DisputeQuickView row={openRow} onClose={() => showPanel(null)} />
    </>
  );
}
