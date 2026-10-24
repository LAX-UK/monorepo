"use client";

import { NewHoldDialog } from "@/components/sales/new-hold-dialog.client";
import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { useListNavigation } from "@/components/use-list-navigation.client";
import { releaseStockHold } from "@/server/application/admin-sales-actions.server";
import { editionLabel } from "@/server/domain/lookup-options.vm";
import {
  type HoldRow,
  presentHoldStatus,
  releaseHoldAvailability,
} from "@/server/domain/sales-records.vm";
import type { AdminStockHoldList } from "@auction/shop-contracts";
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
  formatStaffDateTime,
  useTableDensity,
} from "@auction/staff-ui";
import { Plus } from "@auction/staff-ui/icons";
import { useMemo, useState } from "react";

function ReleaseHoldDialog({ hold, onClose }: { hold: HoldRow; onClose: () => void }) {
  const mutation = useAdminMutation();
  const label = editionLabel(hold);
  return (
    <ConfirmActionDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Release the hold on ${label}?`}
      description="The edition goes back on sale straight away. A released hold cannot be reinstated; create a new hold if the client still wants it."
      confirmLabel="Release hold"
      loading={mutation.pending}
      onConfirm={async () => {
        const ok = await mutation.run(
          () => releaseStockHold({ holdId: hold.holdId, idempotencyKey: mutation.idempotencyKey }),
          `Hold on ${label} released`,
        );
        if (ok) onClose();
      }}
    >
      <StaffMutationError mutation={mutation} />
    </ConfirmActionDialog>
  );
}

/** Stock holds: the list, a New hold dialog, and Release on each active hold. */
export function HoldsList({
  page,
  cursor,
  canHold,
}: {
  page: AdminStockHoldList;
  cursor: string | null;
  canHold: boolean;
}) {
  const { pending, Link: ListLink } = useListNavigation();
  const [density, setDensity] = useTableDensity("holds");
  const [creating, setCreating] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const releasing = page.items.find((hold) => hold.holdId === releasingId) ?? null;

  const columns = useMemo<DataColumn<HoldRow>[]>(
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
        cell: (row) => <MappedStatusBadge status={row.status} present={presentHoldStatus} />,
      },
      {
        id: "expires",
        header: "Ends",
        width: "176px",
        numeric: true,
        sortable: true,
        sortValue: (row) => row.expiresAt,
        defaultSortDirection: "desc",
        mobile: "meta",
        cell: (row) => <time dateTime={row.expiresAt}>{formatStaffDateTime(row.expiresAt)}</time>,
      },
      {
        id: "actions",
        header: "Actions",
        width: "112px",
        mobile: "hidden",
        cell: (row) =>
          releaseHoldAvailability(row, { canRelease: canHold }).kind === "available" ? (
            <StaffButton
              size="sm"
              variant="secondary"
              aria-label={`Release the hold on ${editionLabel(row)}`}
              onClick={() => setReleasingId(row.holdId)}
            >
              Release
            </StaffButton>
          ) : null,
      },
    ],
    [canHold],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stock holds"
        description="Editions held back for a client. A hold ends on its own; release one early if the sale falls through."
        primaryAction={
          canHold ? (
            <StaffButton
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => setCreating(true)}
            >
              New hold
            </StaffButton>
          ) : undefined
        }
      />
      <DataTable
        label="Stock holds"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.holdId}
        defaultSort={{ columnId: "expires", direction: "desc" }}
        density={density}
        loading={pending}
        toolbar={<DataTableToolbar end={<DensityToggle value={density} onChange={setDensity} />} />}
        empty={
          <EmptyState
            title="No stock holds"
            description="Hold an edition for a client and it will be listed here until it ends or is released."
          />
        }
        footer={
          page.items.length > 0 ? (
            <TablePagination
              summary={`${page.items.length} ${page.items.length === 1 ? "hold" : "holds"} on this page`}
              prevHref={cursor ? "/holds" : null}
              prevLabel="First page"
              nextHref={
                page.nextCursor ? `/holds?cursor=${encodeURIComponent(page.nextCursor)}` : null
              }
              Link={ListLink}
            />
          ) : null
        }
      />
      {creating ? <NewHoldDialog open onOpenChange={setCreating} /> : null}
      {releasing ? (
        <ReleaseHoldDialog hold={releasing} onClose={() => setReleasingId(null)} />
      ) : null}
    </div>
  );
}
