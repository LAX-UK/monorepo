"use client";

import {
  COMPLIANCE_RELEASE_BLOCKED,
  useManualReviewActions,
} from "@/components/admin/payments/manual-review-actions";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { useStaffQueue } from "@/components/admin/staff/use-staff-queue";
import {
  MANUAL_REVIEW_REASON_FILTERS,
  type ManualReviewStaffRow,
  type PaymentsListSearch,
  manualReviewMetrics,
  paymentPanelHref,
  paymentsAttention,
  paymentsListHref,
  paymentsViews,
} from "@/lib/admin/finance/payments-staff-list.vm";
import { buildSofCaseDetailHref } from "@/lib/admin/sof-list-query";
import {
  CellLink,
  type DataColumn,
  DataViews,
  DetailPanel,
  FilterSheet,
  type KeyValueItem,
  ListPage,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";
import { type ReactNode, useCallback, useMemo } from "react";

export type ManualReviewStaffListProps = {
  search: PaymentsListSearch;
  rows: ManualReviewStaffRow[];
  /** The hold in the URL (`?payment=`) when the reason filter leaves it out of the rows. */
  selected?: ManualReviewStaffRow | null;
  queueSize: number;
  reasonFilter: string;
  summary: { total: number; financeHolds: number; complianceHolds: number };
  attentionCounts: { manualReviewCount: number; disputesOpen: number };
  canOpenComplianceQueues: boolean;
  canResolveManualReview: boolean;
  /** Lot and client pages need their own capability; without it names show as plain text. */
  canOpenLot: boolean;
  canOpenClient: boolean;
  loadError: string | null;
  /** What the action that sent staff here has to say, shown under the header. */
  notice?: ReactNode;
};

function complianceHref(row: ManualReviewStaffRow): string {
  if (
    row.source.manualReviewReason === "source_of_funds_required" &&
    row.source.sourceOfFundsCaseId
  ) {
    return buildSofCaseDetailHref(row.source.sourceOfFundsCaseId, "pending");
  }
  return row.source.manualReviewReason === "aml_hold"
    ? "/admin/compliance/aml"
    : "/admin/compliance/source-of-funds";
}

/**
 * The manual review queue as a view of Payments: winning payments held before checkout, by hold
 * reason. Release and refund sit in each row's `…` menu and in the record panel, each through a
 * confirm dialog with the amount and the winner; a refund needs a reason. The panel is a work
 * queue: its address is `?payment=`, it shows "3 of 12" and J and K step to the next hold.
 */
export function ManualReviewStaffList(props: ManualReviewStaffListProps) {
  const { search, rows, canOpenLot, canOpenClient } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const money = useManualReviewActions({ canResolve: props.canResolveManualReview });
  const reasonLabel = MANUAL_REVIEW_REASON_FILTERS.find(
    (option) => option.value === props.reasonFilter,
  )?.label;

  const columns = useMemo<DataColumn<ManualReviewStaffRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell
            href={paymentPanelHref(search, row.id)}
            Link={Link}
            secondary={row.lotNumber != null ? `Lot ${row.lotNumber}` : null}
          >
            {row.lotTitle}
          </PrimaryCell>
        ),
      },
      {
        id: "reason",
        header: "Hold",
        width: "200px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <StatusBadge tone={row.compliance ? "danger" : "warning"}>{row.reason}</StatusBadge>
        ),
      },
      {
        id: "winner",
        header: "Winner",
        width: "22%",
        mobile: "meta",
        cell: (row) =>
          canOpenClient ? (
            <CellLink href={`/admin/clients/${encodeURIComponent(row.winnerId)}`} Link={Link}>
              {row.winner}
            </CellLink>
          ) : (
            row.winner
          ),
      },
      {
        id: "seller",
        header: "Seller",
        width: "18%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.seller,
      },
      {
        id: "amount",
        header: "Amount",
        width: "128px",
        numeric: true,
        sortable: true,
        sortValue: (row) => Number.parseFloat(row.source.amount) || 0,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => row.amount,
      },
      {
        id: "held",
        header: "Held since",
        width: "120px",
        sortable: true,
        sortValue: (row) => row.source.createdAt,
        defaultSortDirection: "asc",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => <StaffDate value={row.source.createdAt} />,
      },
    ],
    [search, canOpenClient],
  );

  const hrefFor = useCallback((id: string | null) => paymentPanelHref(search, id), [search]);
  const queue = useStaffQueue({
    param: "payment",
    rows,
    getId: holdId,
    initialId: typeof search.payment === "string" ? search.payment : null,
    hrefFor,
    localSort: { columns, defaultSort: { columnId: "amount", direction: "desc" } },
    selected: props.selected ?? null,
    noun: "hold",
  });
  const openRow = queue.record;

  const linkActions = (row: ManualReviewStaffRow): OverflowAction[] => [
    ...(canOpenLot ? [{ id: "lot", label: "Open lot", href: `/admin/lots/${row.lotId}` }] : []),
    ...(canOpenClient
      ? [
          {
            id: "winner",
            label: "Open winner",
            href: `/admin/clients/${encodeURIComponent(row.winnerId)}`,
          },
        ]
      : []),
    ...(row.compliance && props.canOpenComplianceQueues
      ? [{ id: "case", label: "Open compliance case", href: complianceHref(row) }]
      : []),
  ];
  const rowActions = (row: ManualReviewStaffRow): OverflowAction[] => [
    { id: "open", label: "Review hold", onSelect: () => queue.open(row.id) },
    ...linkActions(row),
    ...money.actionsFor(row),
  ];

  return (
    <>
      <ListPage<ManualReviewStaffRow>
        title="Payments"
        description="Winning payments held before checkout. Compliance holds release only once the MLRO clears the case."
        Link={ListLink}
        listKey="bid-admin.payments.manual-review"
        attention={paymentsAttention(search, props.attentionCounts, "manual-review")}
        metrics={{
          label: "Manual review summary",
          period: "The whole queue, now",
          items: manualReviewMetrics(props.summary),
        }}
        views={
          <DataViews
            views={paymentsViews(search, props.queueSize)}
            activeId="manual-review"
            Link={ListLink}
          />
        }
        filters={
          <FilterSheet
            title="Filter held payments"
            sections={[
              {
                kind: "radio",
                id: "reason",
                label: "Hold reason",
                anyLabel: "Any reason",
                options: [...MANUAL_REVIEW_REASON_FILTERS],
                value: props.reasonFilter,
              },
            ]}
            onApply={(values) =>
              navigate(
                paymentsListHref(search, { manualReviewReason: (values.reason as string) || null }),
              )
            }
          />
        }
        activeFilters={
          reasonLabel
            ? [
                {
                  id: "reason",
                  label: reasonLabel,
                  onRemove: () => navigate(paymentsListHref(search, { manualReviewReason: null })),
                },
              ]
            : []
        }
        onClearFilters={() => navigate(paymentsListHref(search, { manualReviewReason: null }))}
        loading={pending}
        notice={props.notice}
        filtered={Boolean(props.reasonFilter)}
        error={
          props.loadError
            ? {
                description: props.loadError,
                onRetry: () => navigate(paymentsListHref(search, {})),
              }
            : null
        }
        empty={{
          title: "No payments are held",
          description:
            "Payments held for finance or compliance review appear here before checkout can finish.",
        }}
        noResults={{ noun: "held payments" }}
        table={{
          columns,
          ...queue.table,
          getRowId: holdId,
          // The lot cell carries a second line (lot number and sale), which needs 44px rows.
          defaultDensity: "comfortable",
          rowActions: {
            label: (row) => `Actions for held payment ${row.lotTitle}`,
            actions: rowActions,
          },
        }}
      />
      <DetailPanel
        {...queue.panelProps}
        title={openRow?.lotTitle ?? "Held payment"}
        {...(openRow?.lotNumber != null ? { description: `Lot ${openRow.lotNumber}` } : {})}
        status={
          openRow ? (
            <StatusBadge tone={openRow.compliance ? "danger" : "warning"}>
              {openRow.reason}
            </StatusBadge>
          ) : null
        }
        notice={openRow ? <HeldPaymentNotice row={openRow} /> : null}
        headerFacts={["Hold"]}
        summary={openRow ? heldPaymentSummary(openRow) : []}
        meta={
          openRow
            ? [
                { label: "Winner", value: openRow.winner },
                { label: "Amount", value: openRow.amount },
                { label: "Held since", value: <StaffDate value={openRow.source.createdAt} /> },
              ]
            : []
        }
        overflow={
          openRow ? (
            <OverflowMenu
              size="icon-sm"
              label={`More actions for held payment ${openRow.lotTitle}`}
              Link={Link}
              actions={[...linkActions(openRow), ...money.actionsFor(openRow)]}
            />
          ) : null
        }
        footer={
          openRow && props.canResolveManualReview ? (
            <>
              <StaffButton variant="danger-secondary" onClick={() => money.refund(openRow)}>
                Refund {openRow.amount}
              </StaffButton>
              <StaffButton
                variant="primary"
                {...(openRow.compliance ? { disabledReason: COMPLIANCE_RELEASE_BLOCKED } : {})}
                onClick={() => money.release(openRow)}
              >
                Release for checkout
              </StaffButton>
            </>
          ) : null
        }
      >
        {null}
      </DetailPanel>
      {money.dialogs}
    </>
  );
}

function holdId(row: ManualReviewStaffRow): string {
  return row.id;
}

/** What has to happen before the payment can move. */
function HeldPaymentNotice({ row }: { row: ManualReviewStaffRow }) {
  if (row.compliance) {
    return (
      <Notice tone="warning" title="Compliance hold">
        Settlement waits until the MLRO clears the{" "}
        {row.source.manualReviewReason === "aml_hold" ? "AML screening" : "source of funds case"}.
        Finance cannot release checkout while the hold is on.
      </Notice>
    );
  }
  return (
    <Notice tone="info" title="Why it is held">
      {row.source.archiveReason ?? "No reason was recorded."}
    </Notice>
  );
}

/** The held payment's facts; those in the panel's meta line are left out by the kit. */
function heldPaymentSummary(row: ManualReviewStaffRow): KeyValueItem[] {
  const payment = row.source;
  return [
    { label: "Amount", value: row.amount, numeric: true },
    { label: "Hold", value: row.reason },
    { label: "Winner", value: payment.winnerEmail?.trim() || null },
    { label: "Seller", value: payment.sellerDisplayName },
    {
      label: "Seller archived",
      value:
        payment.archiveTimestamp || payment.sellerArchivedAt ? (
          <StaffDate value={payment.archiveTimestamp ?? payment.sellerArchivedAt} withTime />
        ) : null,
    },
    { label: "Held since", value: <StaffDate value={payment.createdAt} withTime /> },
    { label: "Payment ID", value: payment.paymentId, copyValue: payment.paymentId },
  ];
}
