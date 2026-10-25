"use client";

import { RecordThirdPartySaleDialog } from "@/components/sales/record-third-party-sale-dialog.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { filterChip, useWorkList } from "@/components/use-work-list.client";
import { approveSaleFee } from "@/server/application/admin-sales-actions.server";
import { editionLabel } from "@/server/domain/lookup-options.vm";
import { thirdPartySalesList } from "@/server/domain/sales-lists.vm";
import {
  type SaleFeeRow,
  type ThirdPartySaleRow,
  approveFeeAvailability,
  feeSummary,
  pendingFeeOf,
  presentFeeStatus,
  presentThirdPartySaleStatus,
} from "@/server/domain/sales-records.vm";
import type { WorkListState } from "@/server/domain/work-list.vm";
import type { AdminThirdPartySaleList } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  type DataColumn,
  DetailPanel,
  FilterSheet,
  KeyValueList,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  PanelSection,
  PersonCell,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StaffMoney,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import { BadgeCheck, PanelRight, Plus } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

function ApproveFeeDialog({
  sale,
  fee,
  onClose,
}: {
  sale: ThirdPartySaleRow;
  fee: SaleFeeRow;
  onClose: () => void;
}) {
  const action = useAdminAction();
  const amount = formatStaffMoney(fee.amountPence);
  const label = editionLabel(sale);
  return (
    <>
      <ConfirmActionDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={`Approve the ${amount} ${fee.label.toLowerCase()} fee on ${label}?`}
        description="The fee is approved for this sale. An approved fee cannot be changed or withdrawn from LAX Admin."
        confirmLabel={`Approve ${amount} fee`}
        loading={action.pending}
        onConfirm={async () => {
          const ok = await action.run(
            () => approveSaleFee({ feeId: fee.feeId, idempotencyKey: action.idempotencyKey }),
            `${amount} fee on ${label} approved`,
            `approve the ${amount} fee`,
          );
          if (ok) onClose();
        }}
      >
        <KeyValueList
          items={[
            { label: "Sale", value: label },
            { label: "Paid by buyer", value: formatStaffMoney(sale.grossPence), numeric: true },
            { label: "Fee", value: `${fee.label} · ${amount}` },
          ]}
        />
        {action.error}
      </ConfirmActionDialog>
      {action.stepUpDialog}
    </>
  );
}

/**
 * Third-party sales on the staff list template. Who may record a sale and who may approve its
 * fee are different roles, so each action appears only for the role that can take it. A view
 * per status with counts, a filter for fees waiting on approval, search by artwork, seller or
 * buyer, newest first on the server, and a record panel linked from the URL (`?sale=`).
 */
export function ThirdPartySalesList({
  state,
  page,
  canRecord,
  canApproveFees,
  loadFailed = false,
}: {
  state: WorkListState<"fee">;
  page: AdminThirdPartySaleList;
  canRecord: boolean;
  canApproveFees: boolean;
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: thirdPartySalesList,
    state,
    page,
    noun: { one: "sale", other: "sales" },
    search: {
      label: "Search third-party sales",
      placeholder: "Search by artwork, seller or buyer",
    },
  });
  const [recording, setRecording] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const approvingSale = page.items.find((sale) => sale.saleId === approvingId) ?? null;
  const approvingFee = approvingSale ? pendingFeeOf(approvingSale) : null;
  const opened = page.items.find((sale) => sale.saleId === list.panel.openId) ?? null;

  const approveAction = (sale: ThirdPartySaleRow): OverflowAction | null => {
    const fee = pendingFeeOf(sale);
    if (!fee || approveFeeAvailability(fee, { canApprove: canApproveFees }).kind !== "available") {
      return null;
    }
    return {
      id: "approve-fee",
      label: `Approve ${formatStaffMoney(fee.amountPence)} fee…`,
      icon: BadgeCheck,
      onSelect: () => setApprovingId(sale.saleId),
    };
  };

  const columns = useMemo<DataColumn<ThirdPartySaleRow>[]>(
    () => [
      {
        id: "edition",
        header: "Edition",
        mobile: "title",
        cell: (row) => (
          <PrimaryCell href={list.panelHref(row.saleId)} Link={list.panel.PanelLink}>
            {editionLabel(row)}
          </PrimaryCell>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <MappedStatusBadge status={row.status} present={presentThirdPartySaleStatus} />
        ),
      },
      {
        id: "buyer",
        header: "Buyer",
        width: "22%",
        hideBelow: "md",
        mobile: "meta",
        cell: (row) =>
          row.buyerName ? (
            <PersonCell
              name={row.buyerName}
              secondary={row.sellerName ? `From ${row.sellerName}` : null}
            />
          ) : null,
      },
      {
        id: "gross",
        header: "Paid by buyer",
        width: "136px",
        numeric: true,
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffMoney minor={row.grossPence} />,
      },
      {
        id: "fee",
        header: "Fee",
        width: "232px",
        hideBelow: "lg",
        mobile: "hidden",
        truncate: false,
        cell: (row) => {
          const fee = pendingFeeOf(row) ?? row.fees?.[0];
          if (!fee) return null;
          return (
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{feeSummary(row)}</span>
              <MappedStatusBadge status={fee.status} present={presentFeeStatus} />
            </span>
          );
        },
      },
      {
        id: "created",
        header: "Created",
        width: "184px",
        sortable: true,
        defaultSortDirection: "desc",
        hideBelow: "xl",
        mobile: "hidden",
        truncate: false,
        cell: (row) => (row.createdAt ? <StaffDate value={row.createdAt} withTime /> : null),
      },
    ],
    [list.panelHref, list.panel.PanelLink],
  );

  const feeChip = filterChip(
    thirdPartySalesList,
    state,
    list.navigate,
    "fee",
    () => "Fee awaiting approval",
  );
  const openedApprove = opened ? approveAction(opened) : null;

  return (
    <>
      <ListPage<ThirdPartySaleRow>
        title="Third-party sales"
        description="Sales made through partners outside the shop, and the fee approved for each."
        Link={list.Link}
        listKey="lax-admin.third-party-sales"
        primaryAction={
          canRecord ? (
            <StaffButton
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => setRecording(true)}
            >
              Record sale
            </StaffButton>
          ) : undefined
        }
        views={list.views}
        search={list.search}
        filters={
          <FilterSheet
            title="Filter third-party sales"
            sections={[
              {
                kind: "radio",
                id: "fee",
                label: "Fee",
                anyLabel: "Any fee",
                options: [{ value: "pending", label: "Awaiting approval" }],
                value: state.filters.fee ?? "",
              },
            ]}
            onApply={(values) =>
              list.navigate(
                thirdPartySalesList.href(state, { fee: (values.fee as string) || null }),
              )
            }
          />
        }
        activeFilters={[...list.searchChip, ...feeChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Third-party sales did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(thirdPartySalesList.href(state)),
              }
            : null
        }
        empty={{
          illustration: "ledger",
          title: "No third-party sales recorded",
          description: "Sales made outside the shop appear here once they are recorded.",
          ...(canRecord
            ? {
                action: (
                  <StaffButton
                    variant="secondary"
                    icon={<Plus aria-hidden />}
                    onClick={() => setRecording(true)}
                  >
                    Record sale
                  </StaffButton>
                ),
              }
            : {}),
        }}
        noResults={{
          title: "No sales match",
          description: "Try another artwork or person, or clear the filters.",
        }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.saleId,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.saleId),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for the sale of ${editionLabel(row)}`,
            actions: (row) =>
              [
                {
                  id: "open",
                  label: "Open details",
                  icon: PanelRight,
                  onSelect: () => list.panel.show(row.saleId),
                },
                approveAction(row),
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
        title={opened ? editionLabel(opened) : "Third-party sale"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentThirdPartySaleStatus} />
          ) : null
        }
        meta={
          opened
            ? [
                { label: "Paid by buyer", value: formatStaffMoney(opened.grossPence) },
                {
                  label: "Recorded",
                  value: opened.recordedAt
                    ? formatStaffDateTime(opened.recordedAt, { zoneLabel: true })
                    : "Not yet",
                },
              ]
            : []
        }
        summary={
          opened
            ? [
                { label: "Seller", value: opened.sellerName ?? null },
                { label: "Buyer", value: opened.buyerName ?? null },
                {
                  label: "Created",
                  value: opened.createdAt
                    ? formatStaffDateTime(opened.createdAt, { zoneLabel: true })
                    : null,
                },
                { label: "Sale ID", value: opened.saleId, copyValue: opened.saleId },
              ]
            : []
        }
        footer={
          opened && openedApprove ? (
            <StaffButton
              variant="primary"
              icon={<BadgeCheck aria-hidden />}
              onClick={() => setApprovingId(opened.saleId)}
            >
              {openedApprove.label.replace(/…$/, "")}
            </StaffButton>
          ) : null
        }
      >
        {opened && (opened.fees?.length ?? 0) > 0 ? (
          <PanelSection title="Fees">
            <KeyValueList
              items={(opened.fees ?? []).map((fee) => ({
                label: fee.label,
                value: (
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatStaffMoney(fee.amountPence)}</span>
                    <MappedStatusBadge status={fee.status} present={presentFeeStatus} />
                  </span>
                ),
              }))}
            />
          </PanelSection>
        ) : null}
      </DetailPanel>

      {recording ? <RecordThirdPartySaleDialog open onOpenChange={setRecording} /> : null}
      {approvingSale && approvingFee ? (
        <ApproveFeeDialog
          sale={approvingSale}
          fee={approvingFee}
          onClose={() => setApprovingId(null)}
        />
      ) : null}
    </>
  );
}
