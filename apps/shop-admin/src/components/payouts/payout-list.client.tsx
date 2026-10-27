"use client";

import { MarkPayoutPaidDialog } from "@/components/payouts/mark-payout-paid-dialog.client";
import { filterChip, knownFacts, useWorkList } from "@/components/use-work-list.client";
import {
  type PayoutRow,
  markPaidAvailability,
  payoutReference,
  payoutSourceLabel,
  presentPayoutStatus,
} from "@/server/domain/payout-list.vm";
import { payoutsList } from "@/server/domain/sales-lists.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import { ADMIN_PAYOUT_SOURCES, type AdminPayoutList } from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPanel,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PersonCell,
  StaffButton,
  StaffDate,
  StaffMoney,
  formatStaffDate,
  formatStaffDateTime,
  formatStaffMoney,
  toast,
} from "@auction/staff-ui";
import { Banknote, Copy, PanelRight } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

type PayoutState = WorkListState<"source">;

function copyReference(payout: PayoutRow) {
  void navigator.clipboard
    ?.writeText(payout.payoutId)
    .then(() => toast.success("Payout reference copied"));
}

/** Mark paid, as the row menu and the panel offer it: available, or disabled with its reason. */
function markPaidAction(
  payout: PayoutRow,
  canMarkPaid: boolean,
  onPay: () => void,
): OverflowAction | null {
  const availability = markPaidAvailability(payout, { canMarkPaid });
  if (availability.kind === "hidden") return null;
  return {
    id: "mark-paid",
    label: `Mark ${formatStaffMoney(payout.netPence)} paid…`,
    icon: Banknote,
    ...(availability.kind === "blocked"
      ? { disabledReason: availability.reason }
      : { onSelect: onPay }),
  };
}

/**
 * Payouts on the staff list template: a view per status with counts, search by payee or
 * reference, a source filter, the due date as the server sort, and a record panel linked from
 * the URL (`?payout=`). Marking paid always passes through the kit confirm that names the payee,
 * the amount and the reference.
 */
export function PayoutList({
  state,
  page,
  canMarkPaid,
  loadFailed = false,
}: {
  state: PayoutState;
  page: AdminPayoutList;
  canMarkPaid: boolean;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: payoutsList,
    state,
    page,
    noun: { one: "payout", other: "payouts" },
    search: { label: "Search payouts", placeholder: "Search by payee or payout reference" },
  });
  const [payingId, setPayingId] = useState<string | null>(null);
  const opened = page.items.find((item) => item.payoutId === list.panel.openId) ?? null;
  const paying = page.items.find((item) => item.payoutId === payingId) ?? null;

  const columns = useMemo<DataColumn<PayoutRow>[]>(
    () => [
      {
        id: "payee",
        header: "Payee",
        mobile: "title",
        truncate: false,
        cell: (row) => (
          <PersonCell
            name={row.ownerDisplayName}
            secondary={`Ref ${payoutReference(row.payoutId)}`}
            href={list.panelHref(row.payoutId)}
            Link={list.panel.PanelLink}
          />
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "216px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentPayoutStatus} />,
      },
      {
        id: "amount",
        header: "Amount",
        width: "128px",
        numeric: true,
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffMoney minor={row.netPence} />,
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
        id: "due",
        header: "Due",
        width: "136px",
        sortable: true,
        defaultSortDirection: "asc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.payoutDueAt} />,
      },
      {
        id: "created",
        header: "Created",
        width: "176px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => (row.createdAt ? <StaffDate value={row.createdAt} withTime /> : null),
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const sourceChip = filterChip(
    payoutsList,
    state,
    list.navigate,
    "source",
    (value) => `Source: ${payoutSourceLabel(value)}`,
  );
  const openedPay = opened
    ? markPaidAction(opened, canMarkPaid, () => setPayingId(opened.payoutId))
    : null;

  return (
    <>
      <ListPage<PayoutRow>
        title="Payouts"
        description="Money owed to artists and owners after a sale. Mark a due payout paid once the transfer has left the bank."
        Link={list.Link}
        listKey="lax-admin.payouts"
        views={list.views}
        search={list.search}
        filters={
          <FilterSheet
            title="Filter payouts"
            sections={[
              {
                kind: "radio",
                id: "source",
                label: "Source",
                anyLabel: "Any source",
                options: ADMIN_PAYOUT_SOURCES.map((source) => ({
                  value: source,
                  label: payoutSourceLabel(source),
                })),
                value: state.filters.source ?? "",
              },
            ]}
            onApply={(values) =>
              list.navigate(payoutsList.href(state, { source: (values.source as string) || null }))
            }
          />
        }
        activeFilters={[...list.searchChip, ...sourceChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Payouts did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(payoutsList.href(state)),
              }
            : null
        }
        empty={
          state.view === "due"
            ? {
                illustration: "ledger",
                title: "Nothing due to pay",
                description: "Payouts become due once the refund period on the sale has ended.",
              }
            : {
                illustration: "ledger",
                title: "No payouts yet",
                description:
                  "Money owed to artists and owners appears here once a sale has completed.",
              }
        }
        noResults={{ noun: "payouts" }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.payoutId,
          defaultDensity: "comfortable",
          defaultHiddenColumns: ["created"],
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.payoutId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for the payout to ${row.ownerDisplayName}`,
            actions: (row) =>
              [
                {
                  id: "open",
                  label: "Open details",
                  icon: PanelRight,
                  onSelect: () => list.panel.show(row.payoutId),
                },
                markPaidAction(row, canMarkPaid, () => setPayingId(row.payoutId)),
                {
                  id: "copy",
                  label: "Copy payout reference",
                  icon: Copy,
                  onSelect: () => copyReference(row),
                },
              ].filter((action): action is OverflowAction => action !== null),
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened ? `Payout to ${opened.ownerDisplayName}` : "Payout"}
        status={
          opened ? <MappedStatusBadge status={opened.status} present={presentPayoutStatus} /> : null
        }
        meta={
          opened
            ? [
                { label: "Net to pay", value: formatStaffMoney(opened.netPence) },
                { label: "Due", value: formatStaffDate(opened.payoutDueAt) },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                { label: "Gross", value: formatStaffMoney(opened.grossPence), numeric: true },
                {
                  label: "Deductions",
                  value: formatStaffMoney(-opened.deductionsPence),
                  numeric: true,
                },
                { label: "Source", value: payoutSourceLabel(opened.source) },
                // How it was paid, once it has been.
                ...(opened.paidAt
                  ? [
                      {
                        label: "Paid",
                        value: formatStaffDateTime(opened.paidAt, { zoneLabel: true }),
                      },
                    ]
                  : []),
                ...(opened.paidReference
                  ? [
                      {
                        label: "Transfer reference",
                        value: opened.paidReference,
                        copyValue: opened.paidReference,
                      },
                    ]
                  : []),
                {
                  label: "Payout reference",
                  value: payoutReference(opened.payoutId),
                  copyValue: opened.payoutId,
                },
              ])
            : []
        }
        footer={
          opened && openedPay ? (
            <StaffButton
              variant="primary"
              icon={<Banknote aria-hidden />}
              {...(openedPay.disabledReason ? { disabledReason: openedPay.disabledReason } : {})}
              onClick={() => setPayingId(opened.payoutId)}
            >
              Mark {formatStaffMoney(opened.netPence)} paid
            </StaffButton>
          ) : null
        }
      >
        {null}
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
