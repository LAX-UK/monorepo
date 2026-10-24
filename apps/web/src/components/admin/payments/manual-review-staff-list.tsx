"use client";

import { ManualReviewDrawerContent } from "@/components/admin/manual-review-board/drawer";
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
  type DataColumn,
  DataViews,
  DetailPanel,
  FilterSheet,
  ListPage,
  type OverflowAction,
  StatusBadge,
} from "@auction/staff-ui";
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
 * reason, with the release and refund decisions in the record panel.
 */
export function ManualReviewStaffList(props: ManualReviewStaffListProps) {
  const { search, rows } = props;
  const { pending, navigate, Link: ListLink } = useStaffListNavigation();
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = rows.find((row) => row.id === openId) ?? null;
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
          <span className="flex min-w-0 flex-col">
            <Link
              href={`/admin/lots/${row.lotId}`}
              className="staff-focus truncate rounded-staff-xs font-medium underline-offset-2 hover:underline"
            >
              {row.lotTitle}
            </Link>
            {row.lotNumber != null ? (
              <span className="text-staff-xs text-staff-muted">Lot {row.lotNumber}</span>
            ) : null}
          </span>
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
      { id: "winner", header: "Winner", width: "22%", mobile: "meta", cell: (row) => row.winner },
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
    ],
    [],
  );

  const rowActions = (row: ManualReviewStaffRow): OverflowAction[] => [
    { id: "open", label: "Review hold", onSelect: () => setOpenId(row.id) },
    { id: "lot", label: "Open lot", href: `/admin/lots/${row.lotId}` },
    ...(row.compliance && props.canOpenComplianceQueues
      ? [{ id: "case", label: "Open compliance case", href: complianceHref(row) }]
      : []),
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
        description={openRow ? `${openRow.winner} · ${openRow.amount}` : undefined}
        status={
          openRow ? (
            <StatusBadge tone={openRow.compliance ? "danger" : "warning"}>
              {openRow.reason}
            </StatusBadge>
          ) : null
        }
      >
        {openRow ? (
          <ManualReviewDrawerContent
            payment={openRow.source}
            canOpenComplianceQueues={props.canOpenComplianceQueues}
            canResolveManualReview={props.canResolveManualReview}
          />
        ) : null}
      </DetailPanel>
    </>
  );
}
