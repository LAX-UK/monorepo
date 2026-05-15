import { AdminEntityFormShell } from "@/components/admin/admin-entity-form-shell";
import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { saleToAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminEditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, categories] = await Promise.all([
    getAdminSaleById(id),
    (async () => (await getServerCategoryReader()).tree())(),
  ]);
  if (!bundle) notFound();
  const { sale } = bundle;
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  const saleDocuments = await getServerSaleDocuments(id);

  return (
    <AdminEntityFormShell
      breadcrumbs={
        <Link
          href={`/admin/sales/${id}`}
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
        >
          ← Sale
        </Link>
      }
      title="Edit sale"
    >
      <AdminSaleForm
        mode="edit"
        saleId={id}
        saleStatus={sale.status}
        defaultValues={saleToAdminSaleFormValues(sale)}
        categories={categories}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        initialSaleDocuments={saleDocuments}
      />
    </AdminEntityFormShell>
  );
}
