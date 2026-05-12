import { AppScreen } from "@/components/dashboard/dashboard-page";
import {
  adminApproveSaleRegistrationAction,
  adminRejectSaleRegistrationAction,
} from "@/lib/actions/admin";
import {
  type AdminSaleRegistrationRow,
  getAdminSaleById,
  getAdminSaleRegistrations,
} from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function RegistrationRow({ saleId, row }: { saleId: string; row: AdminSaleRegistrationRow }) {
  const pending = row.status === "pending";
  return (
    <tr className="border-b border-outline-variant/20 align-top">
      <td className="py-3 pr-4 font-body text-sm">
        <div className="font-medium">{row.userName ?? row.userEmail ?? row.userId}</div>
        <div className="text-secondary text-xs">{row.userEmail}</div>
      </td>
      <td className="py-3 pr-4 font-body text-sm">
        {row.buyerLegalEntityDisplayName ?? row.buyerLegalEntityId}
      </td>
      <td className="py-3 pr-4 font-body text-sm">{row.bidLimit ?? "—"}</td>
      <td className="py-3 pr-4">
        <StatusBadge
          variant={
            row.status === "approved"
              ? "success"
              : row.status === "pending"
                ? "warning"
                : row.status === "rejected"
                  ? "danger"
                  : "neutral"
          }
        >
          {row.status}
        </StatusBadge>
      </td>
      <td className="py-3 pr-4 font-body text-xs text-secondary">
        {row.requestedAt ? new Date(row.requestedAt).toLocaleString() : "—"}
      </td>
      <td className="py-3 text-right">
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
        ) : (
          <span className="font-body text-xs text-secondary">
            {row.rejectionReason ? `Reason: ${row.rejectionReason}` : "—"}
          </span>
        )}
      </td>
    </tr>
  );
}

export default async function SaleRegistrationsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const err = sp.error;

  const bundle = await getAdminSaleById(id);
  if (!bundle) notFound();

  let rows: AdminSaleRegistrationRow[] = [];
  try {
    rows = await getAdminSaleRegistrations(id);
  } catch {
    rows = [];
  }

  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Sale registrations"
        description={`Approve bidder registrations for “${bundle.sale.title}”.`}
        className="border-0 pb-0"
      />
      {err ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 font-body text-sm text-destructive">
          {err}
        </p>
      ) : null}
      <p className="font-body text-sm">
        <Link
          href={`/admin/sales/${id}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          ← Back to sale
        </Link>
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="No registrations yet"
          description="Buyers who request to bid on this sale will appear here for approval."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/30 font-label text-xs uppercase tracking-widest text-secondary">
                <th className="py-2 pr-4">Bidder</th>
                <th className="py-2 pr-4">Buying as</th>
                <th className="py-2 pr-4">Limit</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Requested</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RegistrationRow key={row.id} saleId={id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppScreen>
  );
}
