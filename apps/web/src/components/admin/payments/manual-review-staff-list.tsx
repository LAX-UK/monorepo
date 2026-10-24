"use client";

import {
  COMPLIANCE_RELEASE_BLOCKED,
  useManualReviewActions,
} from "@/components/admin/payments/manual-review-actions";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import {
  MANUAL_REVIEW_REASON_FILTERS,
  type ManualReviewStaffRow,
  type PaymentsListSearch,
  manualReviewMetrics,
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
  KeyValueList,
  ListPage,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export type ManualReviewStaffListProps = {
  search: PaymentsListSearch;
  rows: ManualReviewStaffRow[];
  queueSize: number;
  reasonFilter: string;
  summary: { total: number; financeHolds: number; complianceHolds: number };
  attentionCounts: { manualReviewCount: number; disputesOpen: number };
  canOpenComplianceQueues: boolean;
  canResolveManualReview: boolean;
  loadError: string | null;
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
 * confirm dialog with the amount and the winner; a refund needs a reason.
 */
export function ManualReviewStaffList(props: ManualReviewStaffListProps) {
  const { search, rows } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = rows.find((row) => row.id === openId) ?? null;
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
            href={`/admin/lots/${row.lotId}`}
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
        cell: (row) => (
          <CellLink href={`/admin/clients/${encodeURIComponent(row.winnerId)}`} Link={Link}>
            {row.winner}
          </CellLink>
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
    [],
  );

  const linkActions = (row: ManualReviewStaffRow): OverflowAction[] => [
    { id: "lot", label: "Open lot", href: `/admin/lots/${row.lotId}` },
    {
      id: "winner",
      label: "Open winner",
      href: `/admin/clients/${encodeURIComponent(row.winnerId)}`,
    },
    ...(row.compliance && props.canOpenComplianceQueues
      ? [{ id: "case", label: "Open compliance case", href: complianceHref(row) }]
      : []),
  ];
  const rowActions = (row: ManualReviewStaffRow): OverflowAction[] => [
    { id: "open", label: "Review hold", onSelect: () => setOpenId(row.id) },
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
        noResults={{ title: "No held payments match", description: "Try another hold reason." }}
        table={{
          columns,
          data: rows,
          getRowId: (row) => row.id,
          defaultSort: { columnId: "amount", direction: "desc" },
          // The lot cell carries a second line (lot number and sale), which needs 44px rows.
          defaultDensity: "comfortable",
          onRowOpen: (row) => setOpenId(row.id),
          activeRowId: openId,
          rowActions: {
            label: (row) => `Actions for held payment ${row.lotTitle}`,
            actions: rowActions,
          },
        }}
      />
      <DetailPanel
        open={openRow !== null}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        title={openRow?.lotTitle ?? "Held payment"}
        {...(openRow?.lotNumber != null ? { description: `Lot ${openRow.lotNumber}` } : {})}
        status={
          openRow ? (
            <StatusBadge tone={openRow.compliance ? "danger" : "warning"}>
              {openRow.reason}
            </StatusBadge>
          ) : null
        }
        meta={
          openRow ? (
            <>
              <MetaItem label="Winner">{openRow.winner}</MetaItem>
              <MetaItem label="Amount">{openRow.amount}</MetaItem>
              <MetaItem label="Held since">
                <StaffDate value={openRow.source.createdAt} />
              </MetaItem>
            </>
          ) : null
        }
        headerActions={
          openRow ? (
            <StaffButton asChild variant="ghost" size="sm" icon={<ArrowUpRight aria-hidden />}>
              <Link href={`/admin/lots/${openRow.lotId}`}>Open lot</Link>
            </StaffButton>
          ) : null
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
        {openRow ? <HeldPaymentBody row={openRow} /> : null}
      </DetailPanel>
      {money.dialogs}
    </>
  );
}

/** The hold, the facts and what has to happen before the payment can move. */
function HeldPaymentBody({ row }: { row: ManualReviewStaffRow }) {
  const payment = row.source;
  const amlHold = payment.manualReviewReason === "aml_hold";
  return (
    <>
      {row.compliance ? (
        <Notice tone="warning" title="Compliance hold" className="mb-6">
          Settlement waits until the MLRO clears the{" "}
          {amlHold ? "AML screening" : "source of funds case"}. Finance cannot release checkout
          while the hold is on.
        </Notice>
      ) : (
        <Notice tone="info" title="Why it is held" className="mb-6">
          {payment.archiveReason ?? "No reason was recorded."}
        </Notice>
      )}
      <PanelSection title="Summary">
        <KeyValueList
          items={[
            { label: "Amount", value: row.amount, numeric: true },
            { label: "Hold", value: row.reason },
            { label: "Winner", value: payment.winnerEmail?.trim() || null },
            { label: "Seller", value: payment.sellerDisplayName },
            {
              label: "Seller archived",
              value:
                payment.archiveTimestamp || payment.sellerArchivedAt ? (
                  <StaffDate
                    value={payment.archiveTimestamp ?? payment.sellerArchivedAt}
                    withTime
                  />
                ) : null,
            },
            { label: "Held since", value: <StaffDate value={payment.createdAt} withTime /> },
            { label: "Payment ID", value: payment.paymentId, copyValue: payment.paymentId },
          ]}
        />
      </PanelSection>
    </>
  );
}
