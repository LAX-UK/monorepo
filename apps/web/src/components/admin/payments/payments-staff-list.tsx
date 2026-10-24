"use client";

import { usePaymentMoneyActions } from "@/components/admin/payments/payment-money-actions";
import { PaymentQuickView } from "@/components/admin/payments/payment-quick-view";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { ExportButton } from "@/components/exports/export-button";
import {
  PAYMENT_STATUS_VIEWS,
  type PaymentsListSearch,
  type PaymentsStaffRow,
  type PaymentsViewId,
  paymentsAttention,
  paymentsListHref,
  paymentsMetrics,
  paymentsViews,
} from "@/lib/admin/finance/payments-staff-list.vm";
import { paymentStatusLabel } from "@/lib/presenters/status-presentation";
import {
  type DataColumn,
  DataViews,
  FilterSheet,
  ListPage,
  StatusBadge,
  TableSearch,
  formatStaffDate,
  staffButtonVariants,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo, useState } from "react";

export type PaymentsStaffListProps = {
  search: PaymentsListSearch;
  view: PaymentsViewId;
  rows: PaymentsStaffRow[];
  summary: { totalVolume: number; pending: number; captured: number; refunded: number };
  attentionCounts: { manualReviewCount: number; disputesOpen: number };
  canWritePayments: boolean;
  exportFilters: Record<string, unknown>;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
  loadError: string | null;
};

/** 24px tall, so adjacent links in the phone layout keep a full pointer target. */
const linkClass =
  "staff-focus inline-block max-w-full truncate align-middle leading-6 rounded-staff-xs hover:underline underline-offset-2";

/**
 * Bid's payments on the staff list template: status views with the manual review queue beside
 * them, search, a status filter, a summary of the matching payments, and capture and refund from
 * each row's `…` menu or the record panel, always through a confirm dialog with the amount.
 */
export function PaymentsStaffList(props: PaymentsStaffListProps) {
  const { search, rows } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(null);
  const money = usePaymentMoneyActions({ canWritePayments: props.canWritePayments });
  const q = typeof search.q === "string" ? search.q : "";
  const status = typeof search.status === "string" ? search.status : "";
  const filtered = Boolean(q || status);

  const columns = useMemo<DataColumn<PaymentsStaffRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        cell: (row) => (
          <Link href={`/admin/lots/${row.lotId}`} className={`${linkClass} font-medium`}>
            {row.lotTitle}
          </Link>
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
          <Link href={`/admin/clients/${encodeURIComponent(row.buyerId)}`} className={linkClass}>
            {row.buyer}
          </Link>
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
          ) : (
            <span className="text-staff-subtle">—</span>
          ),
      },
      {
        id: "xero",
        header: "Xero invoice",
        width: "128px",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) =>
          row.xero.invoiceUrl ? (
            <a
              href={row.xero.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {row.xero.invoiceNumber ?? "Invoice"}
            </a>
          ) : (
            <span className="text-staff-subtle">{row.xero.invoiceNumber ?? "—"}</span>
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
        cell: (row) =>
          row.createdAt ? (
            <time dateTime={row.createdAt} className="text-staff-muted tabular-nums">
              {formatStaffDate(row.createdAt)}
            </time>
          ) : (
            <span className="text-staff-subtle">—</span>
          ),
      },
    ],
    [],
  );

  const activeFilters = [
    ...(q
      ? [
          {
            id: "q",
            label: `“${q}”`,
            onRemove: () => navigate(paymentsListHref(search, { q: null })),
          },
        ]
      : []),
    ...(status
      ? [
          {
            id: "status",
            label: `Status: ${paymentStatusLabel[status as keyof typeof paymentStatusLabel] ?? status}`,
            onRemove: () => navigate(paymentsListHref(search, { status: null })),
          },
        ]
      : []),
  ];
  const clearHref = paymentsListHref({}, {});
  const openRow = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      <ListPage<PaymentsStaffRow>
        title="Payments"
        description="Buyer payments for won lots. Capture held payments, refund captured ones and check their Xero invoices."
        Link={ListLink}
        listKey="bid-admin.payments"
        secondaryActions={
          <ExportButton
            entityType="payments"
            filters={props.exportFilters}
            className={staffButtonVariants({ variant: "secondary", size: "sm" })}
          />
        }
        attention={paymentsAttention(search, props.attentionCounts, props.view)}
        metrics={{
          label: "Payments summary",
          period: filtered ? "Payments matching this view and search" : "All payments",
          items: paymentsMetrics(props.summary),
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
            sections={[
              {
                kind: "radio",
                id: "status",
                label: "Status",
                anyLabel: "Any status",
                options: PAYMENT_STATUS_VIEWS.map((value) => ({
                  value,
                  label: paymentStatusLabel[value],
                })),
                value: status,
              },
            ]}
            onApply={(values) =>
              navigate(paymentsListHref(search, { status: (values.status as string) || null }))
            }
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
          defaultHiddenColumns: ["xero"],
          onRowOpen: (row) => setOpenId(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for payment ${row.lotTitle}`,
            actions: (row) => [
              { id: "open", label: "Open details", onSelect: () => setOpenId(row.id) },
              { id: "lot", label: "Open lot", href: `/admin/lots/${row.lotId}` },
              ...money.actionsFor(row),
            ],
          },
        }}
        pagination={props.pagination}
      />
      <PaymentQuickView
        row={openRow}
        canWritePayments={props.canWritePayments}
        onClose={() => setOpenId(null)}
        onCapture={money.capture}
        onRefund={money.refund}
      />
      {money.dialogs}
    </>
  );
}
