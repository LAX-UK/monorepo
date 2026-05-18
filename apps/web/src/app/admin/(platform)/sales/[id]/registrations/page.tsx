import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { Breadcrumbs } from "@/components/dashboard/primitives/breadcrumbs";
import {
  adminApproveSaleRegistrationAction,
  adminRejectSaleRegistrationAction,
} from "@/lib/actions/admin";
import {
  type AdminSaleRegistrationRow,
  getAdminSaleById,
  getAdminSaleRegistrations,
} from "@/lib/data/http/admin.server";
import { StatusBadge } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function RegistrationRow({ saleId, row }: { saleId: string; row: AdminSaleRegistrationRow }) {
  const pending = row.status === "pending";
  const statusVariant =
    row.status === "approved"
      ? "success"
      : row.status === "pending"
        ? "warning"
        : row.status === "rejected"
          ? "danger"
          : "neutral";

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
              Requested: {new Date(row.requestedAt).toLocaleString()}
            </p>
          ) : null}
          {row.rejectionReason && row.status === "rejected" ? (
            <p className="mt-1 font-body text-xs text-error">Reason: {row.rejectionReason}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusBadge variant={statusVariant}>{row.status}</StatusBadge>
          {pending ? (
            <div className="flex flex-wrap justify-end gap-2">
              <form action={adminApproveSaleRegistrationAction}>
                <input type="hidden" name="saleId" value={saleId} />
                <input type="hidden" name="registrationId" value={row.id} />
                <Button type="submit" size="sm" variant="default" className="min-h-9">
                  Approve
                </Button>
              </form>
              <form
                action={adminRejectSaleRegistrationAction}
                className="flex flex-col items-end gap-1"
              >
                <input type="hidden" name="saleId" value={saleId} />
                <input type="hidden" name="registrationId" value={row.id} />
                <textarea
                  name="reason"
                  placeholder="Optional reason"
                  className="mb-1 min-h-16 w-48 rounded border border-outline-variant/40 bg-surface px-2 py-1 font-body text-xs"
                />
                <Button type="submit" size="sm" variant="outline" className="min-h-9">
                  Reject
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function SaleRegistrationsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  const bundle = await getAdminSaleById(id);
  if (!bundle) notFound();

  let rows: AdminSaleRegistrationRow[] = [];
  let fetchError: string | null = null;
  try {
    rows = await getAdminSaleRegistrations(id);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load registrations.";
  }

  const { sale } = bundle;
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <AdminEntityDetailShell
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Sales", href: "/admin/sales" },
            { label: sale.title, href: `/admin/sales/${id}` },
          ]}
          current="Registrations"
        />
      }
      title="Registrations"
      description={`Approve or reject bidder registrations for "${sale.title}".`}
      meta={
        <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          {rows.length} total · {pending.length} pending
        </span>
      }
    >
      {sp.error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{sp.error}</AlertDescription>
        </Alert>
      ) : null}
      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load registrations</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 && !fetchError ? (
        <EmptyState
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
            <RegistrationRow key={row.id} saleId={id} row={row} />
          ))}
        </section>
      ) : null}

      {decided.length > 0 ? (
        <section className="space-y-3">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Decided ({decided.length})
          </p>
          {decided.map((row) => (
            <RegistrationRow key={row.id} saleId={id} row={row} />
          ))}
        </section>
      ) : null}
    </AdminEntityDetailShell>
  );
}
