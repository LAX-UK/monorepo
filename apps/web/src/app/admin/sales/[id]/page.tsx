import { AdminSaleDetailActions } from "@/components/admin/admin-sale-detail-actions";
import { DisplayHeading } from "@/components/ui/typography";
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

  return (
    <div className="max-w-4xl space-y-8">
      <Link
        href="/admin/sales"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        ← Sales
      </Link>
      <DisplayHeading as="h1" className="text-4xl">
        {sale.title}
      </DisplayHeading>
      <p className="font-label text-xs uppercase tracking-widest text-secondary">
        {sale.status} · {lots.length} lot{lots.length === 1 ? "" : "s"}
      </p>

      <AdminSaleDetailActions
        saleId={id}
        canEdit={canEdit}
        canPublish={canPublish}
        canCancel={canCancel}
        lots={lots}
        draftOrphans={draftOrphans.map((l) => ({ id: l.id, title: l.title }))}
      />
    </div>
  );
}
