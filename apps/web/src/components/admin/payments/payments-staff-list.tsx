"use client";

import { usePaymentMoneyActions } from "@/components/admin/payments/payment-money-actions";
import { PaymentQuickView } from "@/components/admin/payments/payment-quick-view";
import { useListPanel } from "@/components/admin/staff/use-list-panel";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import {
  PAYMENT_FULFILMENT_FILTERS,
  PAYMENT_XERO_FILTERS,
  type PaymentsListSearch,
  type PaymentsStaffRow,
  type PaymentsViewId,
  paymentPanelHref,
  paymentsAttention,
  paymentsFilterChips,
  paymentsListHref,
  paymentsMetrics,
  paymentsMetricsPeriod,
  paymentsViews,
} from "@/lib/admin/finance/payments-staff-list.vm";
import type { AdminPaymentsSummary } from "@/lib/data/http/admin-payments.types";
import {
  CellLink,
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  PrimaryCell,
  StaffDate,
  StatusBadge,
  TableSearch,
  staffButtonVariants,
} from "@auction/staff-ui";
import { Banknote, CircleCheck, Hourglass, Undo2 } from "@auction/staff-ui/icons";
import Link from "next/link";
import { type ReactNode, useCallback, useMemo } from "react";

const PAYMENT_METRIC_ICONS: Record<string, ReactNode> = {
  volume: <Banknote />,
  awaiting: <Hourglass />,
  captured: <CircleCheck />,
  refunded: <Undo2 />,
};

export type PaymentsStaffListProps = {
  search: PaymentsListSearch;
  view: PaymentsViewId;
  rows: PaymentsStaffRow[];
  summary: AdminPaymentsSummary;
  attentionCounts: { manualReviewCount: number; disputesOpen: number };
  canWritePayments: boolean;
  exportFilters: Record<string, unknown>;
  pageSize: number;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/**
 * Bid's payments on the staff list template: status views with the manual review queue beside
 * them, search, fulfilment and Xero filters, a summary of the matching payments, and capture and refund from
 * each row's `…` menu or the record panel, always through a confirm dialog with the amount.
 */
export function PaymentsStaffList(props: PaymentsStaffListProps) {
  const { search, rows } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const panelHref = useCallback((id: string | null) => paymentPanelHref(search, id), [search]);
  const panel = useListPanel({
    param: "payment",
    initialId: typeof search.payment === "string" ? search.payment : null,
    hrefFor: panelHref,
  });
  const openId = panel.openId;
  const money = usePaymentMoneyActions({ canWritePayments: props.canWritePayments });
  const q = typeof search.q === "string" ? search.q : "";
  const status = typeof search.status === "string" ? search.status : "";
  const fulfilment =
    typeof search.fulfilment === "string" ? search.fulfilment.split(",").filter(Boolean) : [];
  const xero = typeof search.xero === "string" ? search.xero : "";
  const filtered = Boolean(q || status || fulfilment.length > 0 || xero);

  const columns = useMemo<DataColumn<PaymentsStaffRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={`/admin/lots/${row.lotId}`} Link={Link} secondary={row.lotContext}>
            {row.lotTitle}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "136px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <StatusBadge tone={row.statusPresentation.tone}>
            {row.statusPresentation.label}
          </StatusBadge>
        ),
      },
      {
        id: "buyer",
        header: "Buyer",
        width: "22%",
        mobile: "meta",
        cell: (row) => (
          <CellLink href={`/admin/clients/${encodeURIComponent(row.buyerId)}`} Link={Link}>
            {row.buyer}
          </CellLink>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        width: "128px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.amountPence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.amount,
      },
      {
        id: "fulfilment",
        header: "Fulfilment",
        width: "184px",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) =>
          row.fulfilment ? (
            <StatusBadge tone={row.fulfilment.tone}>{row.fulfilment.label}</StatusBadge>
          ) : null,
      },
      {
        id: "xero",
        header: "Xero invoice",
        width: "128px",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) =>
          row.xero.invoiceUrl ? (
            <CellLink href={row.xero.invoiceUrl} external>
              {row.xero.invoiceNumber ?? "Invoice"}
            </CellLink>
          ) : (
            row.xero.invoiceNumber
          ),
      },
      {
        id: "created",
        header: "Created",
        width: "120px",
        sortable: true,
        sortValue: (row) => row.createdAt,
        defaultSortDirection: "desc",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.createdAt} />,
      },
    ],
    [],
  );

  const activeFilters = paymentsFilterChips(search).map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => navigate(chip.clearHref),
  }));
  // Clearing filters keeps the status view: the tab is where status is chosen.
  const clearHref = paymentsListHref(search, { q: null, fulfilment: null, xero: null });
  const openRow = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      <ListPage<PaymentsStaffRow>
        title="Payments"
        description="Buyer payments for won lots. Capture held payments, refund captured ones and check their Xero invoices."
        Link={ListLink}
        listKey="bid-admin.payments"
        exportAction={
          <ExportButton
            entityType="payments"
            filters={props.exportFilters}
            className={staffButtonVariants({ variant: "secondary", size: "sm" })}
          />
        }
        attention={paymentsAttention(search, props.attentionCounts, props.view)}
        metrics={{
          label: "Payments summary",
          period: paymentsMetricsPeriod(props.summary, filtered),
          items: paymentsMetrics(props.summary, search).map((metric) => ({
            ...metric,
            icon: PAYMENT_METRIC_ICONS[metric.id],
          })),
        }}
        views={
          <DataViews
            views={paymentsViews(search, props.attentionCounts.manualReviewCount)}
            activeId={props.view}
            Link={ListLink}
          />
        }
        search={
          <TableSearch
            key={q}
            fullWidth
            label="Search payments"
            placeholder="Search by lot, buyer or payment ID"
            value={q}
            onSearch={(next) => navigate(paymentsListHref(search, { q: next || null }))}
          />
        }
        filters={
          <FilterSheet
            title="Filter payments"
            description="Status is set by the tabs above the list."
            sections={[
              {
                kind: "checklist",
                id: "fulfilment",
                label: "Lot fulfilment",
                options: PAYMENT_FULFILMENT_FILTERS,
                value: fulfilment,
              },
              {
                kind: "radio",
                id: "xero",
                label: "Xero invoice",
                anyLabel: "Any",
                options: PAYMENT_XERO_FILTERS,
                value: xero,
              },
            ]}
            onApply={(values) => {
              const nextFulfilment = (values.fulfilment as readonly string[]) ?? [];
              navigate(
                paymentsListHref(search, {
                  fulfilment: nextFulfilment.length > 0 ? nextFulfilment.join(",") : null,
                  xero: (values.xero as string) || null,
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
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(paymentsListHref(search, {})),
              }
            : null
        }
        empty={{
          title: "No payments yet",
          description: "Payments appear here when a buyer checks out a won lot.",
        }}
        noResults={{
          title: "No payments match",
          description: "Try a different search or status, or clear the filters.",
        }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultSort: { columnId: "created", direction: "desc" },
          // The lot cell carries a second line (lot number and sale), which needs 44px rows.
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["xero"],
          onRowOpen: (row) => panel.show(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for payment ${row.lotTitle}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => panel.show(row.id) },
              { id: "lot", label: "Open lot", href: `/admin/lots/${row.lotId}` },
              ...money.actionsFor(row),
            ],
          },
        }}
        pageSize={{
          value: props.pageSize,
          onChange: (size) => navigate(paymentsListHref(search, { limit: size })),
        }}
        pagination={props.pagination}
      />
      <PaymentQuickView
        row={openRow}
        canWritePayments={props.canWritePayments}
        onClose={() => panel.show(null)}
        onCapture={money.capture}
        onRefund={money.refund}
        moneyActions={openRow ? money.actionsFor(openRow) : []}
      />
      {money.dialogs}
    </>
  );
}
