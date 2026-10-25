"use client";

import { RecordThirdPartySaleDialog } from "@/components/sales/record-third-party-sale-dialog.client";
import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { useListNavigation } from "@/components/use-list-navigation.client";
import { approveSaleFee } from "@/server/application/admin-sales-actions.server";
import { editionLabel } from "@/server/domain/lookup-options.vm";
import {
  type SaleFeeRow,
  type ThirdPartySaleRow,
  approveFeeAvailability,
  feeSummary,
  pendingFeeOf,
  presentFeeStatus,
  presentThirdPartySaleStatus,
} from "@/server/domain/sales-records.vm";
import type { AdminThirdPartySaleList } from "@auction/shop-contracts";
import {
  ConfirmActionDialog,
  type DataColumn,
  DataTable,
  DataTableToolbar,
  DensityToggle,
  EmptyState,
  MappedStatusBadge,
  PageHeader,
  StaffButton,
  TablePagination,
  formatGbp,
  formatStaffDateTime,
  useTableDensity,
} from "@auction/staff-ui";
import { Plus } from "@auction/staff-ui/icons";
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
  const mutation = useAdminMutation();
  const amount = formatGbp(fee.amountPence);
  const label = editionLabel(sale);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Approve the ${amount} ${fee.label.toLowerCase()} fee on ${label}?`}
      description="The fee is approved for this sale. An approved fee cannot be changed or withdrawn from LAX Admin."
      confirmLabel={`Approve ${amount} fee`}
      loading={mutation.pending}
      onConfirm={async () => {
        const ok = await mutation.run(
          () => approveSaleFee({ feeId: fee.feeId, idempotencyKey: mutation.idempotencyKey }),
          `${amount} fee on ${label} approved`,
        );
        if (ok) onClose();
      }}
    >
      <StaffMutationError mutation={mutation} />
    </ConfirmActionDialog>
  );
}

/**
 * Third-party sales: who may record one and who may approve its fee are different roles, so each
 * action appears only for the role that can take it. A fee is approved from its sale's row.
 */
export function ThirdPartySalesList({
  page,
  cursor,
  canRecord,
  canApproveFees,
}: {
  page: AdminThirdPartySaleList;
  cursor: string | null;
  canRecord: boolean;
  canApproveFees: boolean;
}) {
  const { pending, Link: ListLink } = useListNavigation();
  const [density, setDensity] = useTableDensity("third-party-sales");
  const [recording, setRecording] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const approvingSale = page.items.find((sale) => sale.saleId === approvingId) ?? null;
  const approvingFee = approvingSale ? pendingFeeOf(approvingSale) : null;

  const columns = useMemo<DataColumn<ThirdPartySaleRow>[]>(
    () => [
      {
        id: "edition",
        header: "Edition",
        mobile: "title",
        cell: (row) => <span className="font-medium text-staff-fg">{editionLabel(row)}</span>,
      },
      {
        id: "status",
        header: "Status",
        width: "136px",
        mobile: "badge",
        cell: (row) => (
          <MappedStatusBadge status={row.status} present={presentThirdPartySaleStatus} />
        ),
      },
      {
        id: "gross",
        header: "Paid by buyer",
        width: "136px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.grossPence,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => formatGbp(row.grossPence),
      },
      {
        id: "fee",
        header: "Fee",
        width: "208px",
        mobile: "hidden",
        cell: (row) => {
          const fee = row.fees?.[0];
          if (!fee) return <span className="text-staff-subtle">—</span>;
          return (
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{feeSummary(row)}</span>
              <MappedStatusBadge status={fee.status} present={presentFeeStatus} />
            </span>
          );
        },
      },
      {
        id: "recorded",
        header: "Recorded",
        width: "176px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.recordedAt,
        defaultSortDirection: "desc",
        hideBelow: "lg",
        mobile: "meta",
        cell: (row) =>
          row.recordedAt ? (
            <time dateTime={row.recordedAt}>{formatStaffDateTime(row.recordedAt)}</time>
          ) : (
            <span className="text-staff-subtle">—</span>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "136px",
        mobile: "hidden",
        cell: (row) => {
          const fee = pendingFeeOf(row);
          if (
            !fee ||
            approveFeeAvailability(fee, { canApprove: canApproveFees }).kind !== "available"
          ) {
            return null;
          }
          return (
            <StaffButton
              size="sm"
              variant="secondary"
              aria-label={`Approve the fee on ${editionLabel(row)}`}
              onClick={() => setApprovingId(row.saleId)}
            >
              Approve fee
            </StaffButton>
          );
        },
      },
    ],
    [canApproveFees],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Third-party sales"
        description="Sales made through partners outside the shop, and the fee approved for each."
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
      />
      <DataTable
        label="Third-party sales"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.saleId}
        defaultSort={{ columnId: "recorded", direction: "desc" }}
        density={density}
        loading={pending}
        toolbar={<DataTableToolbar end={<DensityToggle value={density} onChange={setDensity} />} />}
        empty={
          <EmptyState
            illustration="ledger"
            title="No third-party sales recorded"
            description="Sales made outside the shop appear here once they are recorded."
          />
        }
        footer={
          page.items.length > 0 ? (
            <TablePagination
              summary={`${page.items.length} ${page.items.length === 1 ? "sale" : "sales"} on this page`}
              prevHref={cursor ? "/third-party-sales" : null}
              prevLabel="First page"
              nextHref={
                page.nextCursor
                  ? `/third-party-sales?cursor=${encodeURIComponent(page.nextCursor)}`
                  : null
              }
              Link={ListLink}
            />
          ) : null
        }
      />
      {recording ? <RecordThirdPartySaleDialog open onOpenChange={setRecording} /> : null}
      {approvingSale && approvingFee ? (
        <ApproveFeeDialog
          sale={approvingSale}
          fee={approvingFee}
          onClose={() => setApprovingId(null)}
        />
      ) : null}
    </div>
  );
}
