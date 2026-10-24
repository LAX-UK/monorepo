"use client";

import { MarkPayoutPaidDialog } from "@/components/payouts/mark-payout-paid-dialog.client";
import { useListNavigation } from "@/components/use-list-navigation.client";
import {
  type PayoutRow,
  markPaidAvailability,
  payoutQueueKey,
  payoutReference,
  payoutSourceLabel,
  presentPayoutStatus,
} from "@/server/domain/payout-list.vm";
import type { AdminPayoutList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DensityToggle,
  DetailPanel,
  EmptyState,
  KeyValueList,
  MappedStatusBadge,
  type OverflowAction,
  OverflowMenu,
  PanelSection,
  StaffButton,
  TablePagination,
  formatGbp,
  formatStaffDate,
  formatStaffDateTime,
  toast,
  useTableDensity,
} from "@auction/staff-ui";
import { Banknote, Copy } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

function copyReference(payout: PayoutRow) {
  void navigator.clipboard
    ?.writeText(payout.payoutId)
    .then(() => toast.success("Payout reference copied"));
}

/** The row's `…` menu: Mark paid (disabled with its reason while blocked) and Copy reference. */
function payoutMenuActions(payout: PayoutRow, canMarkPaid: boolean) {
  const availability = markPaidAvailability(payout, { canMarkPaid });
  const actions: OverflowAction[] = [];
  if (availability.kind === "blocked") {
    actions.push({
      id: "mark-paid",
      label: "Mark as paid…",
      icon: Banknote,
      disabledReason: availability.reason,
    });
  }
  actions.push({
    id: "copy",
    label: "Copy payout reference",
    icon: Copy,
    onSelect: () => copyReference(payout),
  });
  return actions;
}

/**
 * The payouts list. Marking paid is one click on a due row (or in its panel), and always passes
 * through a confirmation that names the payee, the amount and the reference. Payouts that cannot
 * be paid show no action, or a disabled one that says why.
 */
export function PayoutList({
  page,
  cursor,
  canMarkPaid,
}: {
  page: AdminPayoutList;
  cursor: string | null;
  canMarkPaid: boolean;
}) {
  const { pending, Link: ListLink } = useListNavigation();
  const [density, setDensity] = useTableDensity("payouts");
  const [openId, setOpenId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const opened = page.items.find((item) => item.payoutId === openId) ?? null;
  const paying = page.items.find((item) => item.payoutId === payingId) ?? null;

  const columns = useMemo<DataColumn<PayoutRow>[]>(
    () => [
      {
        id: "payee",
        header: "Payee",
        mobile: "title",
        sortable: true,
        sortValue: (row) => row.ownerDisplayName.toLowerCase(),
        cell: (row) => <span className="font-medium text-staff-fg">{row.ownerDisplayName}</span>,
      },
      {
        id: "reference",
        header: "Reference",
        width: "120px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => <span className="text-staff-muted">{payoutReference(row.payoutId)}</span>,
      },
      {
        id: "source",
        header: "Source",
        width: "160px",
        hideBelow: "xl",
        mobile: "hidden",
        cell: (row) => payoutSourceLabel(row.source),
      },
      {
        id: "amount",
        header: "Amount",
        width: "120px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.netPence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => formatGbp(row.netPence),
      },
      {
        id: "status",
        header: "Status",
        width: "216px",
        sortable: true,
        sortValue: payoutQueueKey,
        mobile: "badge",
        cell: (row) => <MappedStatusBadge status={row.status} present={presentPayoutStatus} />,
      },
      {
        id: "due",
        header: "Due",
        width: "120px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.payoutDueAt,
        mobile: "meta",
        cell: (row) => <time dateTime={row.payoutDueAt}>{formatStaffDate(row.payoutDueAt)}</time>,
      },
      {
        id: "actions",
        header: "Actions",
        width: "176px",
        mobile: "hidden",
        cell: (row) => {
          const inline = markPaidAvailability(row, { canMarkPaid }).kind === "available";
          return (
            <span className="flex items-center justify-end gap-1">
              {inline ? (
                <StaffButton
                  size="sm"
                  variant="secondary"
                  aria-label={`Mark the payout to ${row.ownerDisplayName} as paid`}
                  onClick={() => setPayingId(row.payoutId)}
                >
                  Mark paid
                </StaffButton>
              ) : null}
              <OverflowMenu
                size="icon-sm"
                label={`Actions for the payout to ${row.ownerDisplayName}`}
                actions={payoutMenuActions(row, canMarkPaid)}
              />
            </span>
          );
        },
      },
    ],
    [canMarkPaid],
  );

  const availability = opened ? markPaidAvailability(opened, { canMarkPaid }) : null;

  return (
    <>
      <DataTable
        label="Payouts"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.payoutId}
        defaultSort={{ columnId: "status", direction: "asc" }}
        density={density}
        loading={pending}
        onRowOpen={(row) => setOpenId(row.payoutId)}
        activeRowId={openId}
        toolbar={<DataTableToolbar end={<DensityToggle value={density} onChange={setDensity} />} />}
        empty={
          <EmptyState
            title="No payouts yet"
            description="Money owed to artists and owners appears here once a sale has completed."
          />
        }
        footer={
          page.items.length > 0 ? (
            <TablePagination
              summary={`${page.items.length} ${page.items.length === 1 ? "payout" : "payouts"} on this page`}
              prevHref={cursor ? "/payouts" : null}
              prevLabel="First page"
              nextHref={
                page.nextCursor ? `/payouts?cursor=${encodeURIComponent(page.nextCursor)}` : null
              }
              Link={ListLink}
            />
          ) : null
        }
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        title={opened ? `Payout to ${opened.ownerDisplayName}` : "Payout"}
        description={
          opened ? `${formatGbp(opened.netPence)} · ${payoutReference(opened.payoutId)}` : ""
        }
        status={
          opened ? <MappedStatusBadge status={opened.status} present={presentPayoutStatus} /> : null
        }
        footer={
          opened && availability && availability.kind !== "hidden" ? (
            <StaffButton
              variant="primary"
              icon={<Banknote aria-hidden />}
              {...(availability.kind === "blocked" ? { disabledReason: availability.reason } : {})}
              onClick={() => {
                setPayingId(opened.payoutId);
                setOpenId(null);
              }}
            >
              Mark {formatGbp(opened.netPence)} paid
            </StaffButton>
          ) : null
        }
      >
        {opened ? (
          <>
            <PanelSection title="Payment">
              <KeyValueList
                items={[
                  { label: "Payee", value: opened.ownerDisplayName },
                  { label: "Gross", value: formatGbp(opened.grossPence), numeric: true },
                  {
                    label: "Deductions",
                    value: formatGbp(opened.deductionsPence),
                    numeric: true,
                  },
                  { label: "Net to pay", value: formatGbp(opened.netPence), numeric: true },
                ]}
              />
            </PanelSection>
            <PanelSection title="Record">
              <KeyValueList
                items={[
                  {
                    label: "Payout reference",
                    value: payoutReference(opened.payoutId),
                    copyValue: opened.payoutId,
                  },
                  { label: "Source", value: payoutSourceLabel(opened.source) },
                  { label: "Due", value: formatStaffDate(opened.payoutDueAt) },
                  {
                    label: "Paid",
                    value: opened.paidAt ? formatStaffDateTime(opened.paidAt) : null,
                  },
                  {
                    label: "Paid reference",
                    value: opened.paidReference ?? null,
                    ...(opened.paidReference ? { copyValue: opened.paidReference } : {}),
                  },
                ]}
              />
            </PanelSection>
          </>
        ) : null}
      </DetailPanel>

      {paying ? (
        <MarkPayoutPaidDialog
          payout={paying}
          open
          onOpenChange={(open) => {
            if (!open) setPayingId(null);
          }}
        />
      ) : null}
    </>
  );
}
