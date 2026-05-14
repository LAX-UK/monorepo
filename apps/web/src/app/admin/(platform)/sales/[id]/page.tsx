import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminSaleDetailActions } from "@/components/admin/admin-sale-detail-actions";
import { getAdminLotList, getAdminSaleById } from "@/lib/data/http/admin.server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminSaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getAdminSaleById(id);
  if (!bundle) notFound();
  const { sale, lots } = bundle;

  let draftOrphans = await getAdminLotList({ status: "draft", limit: 100, offset: 0 });
  draftOrphans = draftOrphans.filter((l) => l.saleId == null);

  const canEdit = sale.status === "draft";
  const canPublish = sale.status === "draft";
  const canCancel =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const isOnsite = sale.deliveryMode === "onsite";
  const canMarkOnsiteEnded = isOnsite && (sale.status === "active" || sale.status === "scheduled");

  return (
    <AdminEntityDetailShell
      className="space-y-8"
      breadcrumbs={
        <Link
          href="/admin/sales"
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Sales
        </Link>
      }
      title={sale.title}
      meta={
        <span className="font-label text-xs uppercase tracking-widest text-secondary">
          {sale.status} · {sale.deliveryMode} · {lots.length} lot{lots.length === 1 ? "" : "s"}
        </span>
      }
      actions={
        <AdminSaleDetailActions
          saleId={id}
          saleTitle={sale.title}
          saleStatus={sale.status}
          deliveryMode={sale.deliveryMode}
          canEdit={canEdit}
          canPublish={canPublish}
          canCancel={canCancel}
          canMarkOnsiteEnded={canMarkOnsiteEnded}
          lots={lots.map((l) => ({
            id: l.id,
            title: l.title,
            lotNumber: l.lotNumber,
            status: l.status,
          }))}
          draftOrphans={draftOrphans.map((l) => ({ id: l.id, title: l.title }))}
        />
      }
    >
      {sale.status === "scheduled" || sale.status === "active" ? (
        <p className="font-body text-sm">
          <Link
            href={`/admin/sales/${id}/registrations`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {isOnsite ? "Paddle registrations & approvals" : "Bidder registrations & approvals"}
          </Link>
        </p>
      ) : null}
    </AdminEntityDetailShell>
  );
}
