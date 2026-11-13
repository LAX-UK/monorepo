"use client";

import { RecordAgreementDialog } from "@/components/admin/seller-proceeds/record-agreement-dialog";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { downloadCsv } from "@/lib/admin/exports/download-csv";
import {
  type PayoutsListSearch,
  type PayoutsViewId,
  payoutsViews,
} from "@/lib/admin/finance/payouts-staff-list.vm";
import {
  HELD_SALES_EMPTY,
  HELD_SALES_NOTE,
  type HeldSaleRow,
} from "@/lib/admin/seller-proceeds/held-sales.vm";
import {
  OLD_RULE_CSV_COLUMNS,
  OLD_RULE_EMPTY,
  OLD_RULE_NOTICE,
  type OldRuleCsvKey,
  type OldRuleRow,
} from "@/lib/admin/seller-proceeds/old-rule-review.vm";
import type { RecordAgreementContext } from "@/lib/admin/seller-proceeds/record-agreement.vm";
import {
  CellLink,
  CsvExportMenu,
  type DataColumn,
  DataViews,
  ListPage,
  Notice,
  londonToday,
} from "@auction/staff-ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const DESCRIPTION =
  "Seller payouts. Run settlement, add adjustments, mark transfers as paid and reverse payouts.";

function Views({ search, view }: { search: PayoutsListSearch; view: PayoutsViewId }) {
  const { Link: ListLink } = useStaffListNavigation();
  return <DataViews views={payoutsViews(search)} activeId={view} Link={ListLink} />;
}

/** Every paid sale whose payout is held, across sellers, with the fix where recording helps. */
export function HeldSalesList({
  search,
  rows,
  loadError,
  canRecord,
}: {
  search: PayoutsListSearch;
  rows: HeldSaleRow[];
  loadError: string | null;
  canRecord: boolean;
}) {
  const { navigate, Link: ListLink } = useStaffListNavigation();
  const [recordFor, setRecordFor] = useState<RecordAgreementContext | null>(null);
  const columns = useMemo<DataColumn<HeldSaleRow>[]>(
    () => [
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        cell: (row) => (
          <span className="flex flex-col">
            <CellLink href={row.lotHref} Link={Link}>
              {row.lot}
            </CellLink>
            <span className="text-staff-xs text-staff-muted">{row.lotTitle}</span>
          </span>
        ),
      },
      {
        id: "seller",
        header: "Seller",
        mobile: "meta",
        cell: (row) => (
          <CellLink href={row.sellerHref} Link={Link}>
            {row.seller}
          </CellLink>
        ),
      },
      { id: "hammer", header: "Hammer", width: "128px", numeric: true, cell: (row) => row.hammer },
      {
        id: "reason",
        header: "Why it is held",
        mobile: "meta",
        cell: (row) => <span className="text-staff-danger-fg">{row.reason}</span>,
      },
    ],
    [],
  );
  return (
    <>
      <ListPage<HeldSaleRow>
        title="Payouts"
        description={DESCRIPTION}
        Link={ListLink}
        listKey="bid-admin.payouts.held"
        access="read-only"
        notice={<p className="text-staff-sm text-staff-muted">{HELD_SALES_NOTE}</p>}
        views={<Views search={search} view="held" />}
        filtered={false}
        error={
          loadError
            ? { description: loadError, onRetry: () => navigate("/admin/payouts?view=held") }
            : null
        }
        empty={{
          title: HELD_SALES_EMPTY,
          description: "Every paid sale has what its payout needs.",
        }}
        noResults={{ noun: "held sales" }}
        table={{
          label: "Held sales",
          columns,
          data: rows,
          getRowId: (row) => row.id,
          rowActions: {
            label: (row) => `Actions for ${row.lot}`,
            actions: (row) => [
              { id: "lot", label: "Open lot", href: row.lotHref },
              ...(canRecord && row.record
                ? [
                    {
                      id: "record",
                      label: "Record signed agreement",
                      onSelect: () => setRecordFor(row.record),
                    },
                  ]
                : []),
            ],
          },
        }}
      />
      {recordFor ? (
        <RecordAgreementDialog
          open
          onOpenChange={(open) => {
            if (!open) setRecordFor(null);
          }}
          context={recordFor}
        />
      ) : null}
    </>
  );
}

/**
 * Sales paid before seller payouts followed the signed agreement, each beside what the agreement
 * gives. Read only, with an export; finance decides each one outside this list.
 */
export function OldRuleList({
  search,
  rows,
  total,
  loadError,
  pagination,
  exportRows,
}: {
  search: PayoutsListSearch;
  rows: OldRuleRow[];
  total: number;
  /** Every row for the export, not just this page (a server action). */
  exportRows: () => Promise<Record<OldRuleCsvKey, string>[]>;
  loadError: string | null;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
}) {
  const { navigate, Link: ListLink } = useStaffListNavigation();
  const columns = useMemo<DataColumn<OldRuleRow>[]>(
    () => [
      { id: "paid", header: "Paid", width: "112px", mobile: "meta", cell: (row) => row.paidOn },
      { id: "seller", header: "Seller", mobile: "meta", cell: (row) => row.seller },
      {
        id: "lot",
        header: "Lot",
        mobile: "title",
        cell: (row) => (
          <span className="flex flex-col">
            <CellLink href={row.lotHref} Link={Link}>
              {row.lot}
            </CellLink>
            <span className="text-staff-xs text-staff-muted">{row.lotTitle}</span>
          </span>
        ),
      },
      { id: "hammer", header: "Hammer", numeric: true, hideBelow: "lg", cell: (row) => row.hammer },
      { id: "paidNet", header: "Seller was paid", numeric: true, cell: (row) => row.paid },
      {
        id: "agreement",
        header: "Agreement gives",
        numeric: true,
        cell: (row) =>
          row.agreementGives ? (
            <span className="flex flex-col items-end">
              <span>{row.agreementGives}</span>
              <span className="text-staff-xs text-staff-muted">{row.agreementRate}</span>
            </span>
          ) : (
            <span className="text-staff-muted">{row.agreementRate}</span>
          ),
      },
      {
        id: "difference",
        header: "Difference",
        numeric: true,
        cell: (row) => row.difference ?? <span className="text-staff-muted">—</span>,
      },
    ],
    [],
  );
  return (
    <ListPage<OldRuleRow>
      title="Payouts"
      description={DESCRIPTION}
      Link={ListLink}
      listKey="bid-admin.payouts.old-rule"
      access="read-only"
      notice={
        <Notice tone="info" title="Paid under the old rule">
          {OLD_RULE_NOTICE}
        </Notice>
      }
      exportAction={
        <CsvExportMenu
          noun="sales"
          // The export is every sale paid under the old rule, whichever page is on screen.
          shown={total}
          total={total}
          onExport={() => {
            void exportRows().then(
              (all) =>
                downloadCsv(`payouts-old-rule-${londonToday()}.csv`, OLD_RULE_CSV_COLUMNS, all),
              () => toast.error("The export could not be made. Try again in a moment."),
            );
          }}
        />
      }
      views={<Views search={search} view="old_rule" />}
      filtered={false}
      error={
        loadError
          ? { description: loadError, onRetry: () => navigate("/admin/payouts?view=old_rule") }
          : null
      }
      empty={{
        title: OLD_RULE_EMPTY,
        description: "Every payout was paid under the signed agreement.",
        illustration: "plinth",
      }}
      noResults={{ noun: "sales" }}
      table={{
        label: "Sales paid under the old rule",
        columns,
        data: rows,
        getRowId: (row) => row.id,
      }}
      pagination={pagination}
    />
  );
}
