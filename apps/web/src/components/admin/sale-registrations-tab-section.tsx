import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SaleRegistrationRejectButton } from "@/components/admin/sale-registration-reject-button";
import { adminApproveSaleRegistrationAction } from "@/lib/actions/admin";
import { saleStatusLabel } from "@/lib/admin/status-badge-variants";
import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import type { SaleStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";

function RegistrationRow({ saleId, row }: { saleId: string; row: AdminSaleRegistrationRow }) {
  const pending = row.status === "pending";
  return (
    <div className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{row.userName ?? row.userEmail ?? row.userId}</p>
          {row.userEmail && row.userEmail !== (row.userName ?? "") ? (
            <p className="font-body text-xs text-on-surface-variant">{row.userEmail}</p>
          ) : null}
          {row.buyerLegalEntityDisplayName ? (
            <p className="font-body text-xs text-on-surface-variant">
              Entity: {row.buyerLegalEntityDisplayName}
            </p>
          ) : null}
          {row.memberRole ? (
            <p className="font-body text-xs text-on-surface-variant">Role: {row.memberRole}</p>
          ) : null}
          {row.bidLimit ? (
            <p className="font-body text-xs text-on-surface-variant">Limit: {row.bidLimit}</p>
          ) : null}
          {row.requestedAt ? (
            <p className="font-body text-xs text-on-surface-variant">
              Requested: {formatDateTime(row.requestedAt)}
            </p>
          ) : null}
          {row.rejectionReason && row.status === "rejected" ? (
            <p className="mt-1 font-body text-xs text-error">Reason: {row.rejectionReason}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-3">
          <AdminStatusBadge domain="registration" status={row.status} />
          {pending ? (
            <div className="flex flex-wrap justify-end gap-2">
              <form action={adminApproveSaleRegistrationAction}>
                <input type="hidden" name="saleId" value={saleId} />
                <input type="hidden" name="registrationId" value={row.id} />
                <Button type="submit" size="sm" variant="default" className="min-h-9">
                  Approve
                </Button>
              </form>
              <SaleRegistrationRejectButton
                saleId={saleId}
                registrationId={row.id}
                reasonFieldId={`reject-reason-${row.id}`}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Props = {
  saleId: string;
  saleStatus: SaleStatus;
  liveish: boolean;
  rows: AdminSaleRegistrationRow[];
  fetchError?: string | null;
  actionError?: string | null;
};

export function SaleRegistrationsTabSection({
  saleId,
  saleStatus,
  liveish,
  rows,
  fetchError = null,
  actionError = null,
}: Props) {
  if (!liveish) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        Registrations open when the sale is scheduled or live. Current status:{" "}
        <strong>{saleStatusLabel[saleStatus]}</strong>.
      </p>
    );
  }

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-on-surface-variant">
        {rows.length} registration{rows.length === 1 ? "" : "s"} · {pending.length} pending
      </p>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load registrations</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 && !fetchError ? (
        <AdminEmptyState
          title="No registrations yet"
          description="Buyers who request to bid on this sale will appear here for approval."
        />
      ) : null}

      {pending.length > 0 ? (
        <section className="space-y-3">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Pending ({pending.length})
          </p>
          {pending.map((row) => (
            <RegistrationRow key={row.id} saleId={saleId} row={row} />
          ))}
        </section>
      ) : null}

      {decided.length > 0 ? (
        <section className="space-y-3">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Decided ({decided.length})
          </p>
          {decided.map((row) => (
            <RegistrationRow key={row.id} saleId={saleId} row={row} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
