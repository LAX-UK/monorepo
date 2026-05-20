import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  buildCoverImagePreviewMap,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
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
  const previewUrlByKey = buildCoverImagePreviewMap(
    sale.coverImages,
    "coverImagePresentedUrls" in sale
      ? (sale as { coverImagePresentedUrls?: string[] }).coverImagePresentedUrls
      : undefined,
  );

  return (
    <CatalogFormShell
      breadcrumbs={
        <Link
          href={`/admin/sales/${id}`}
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Sale
        </Link>
      }
      title="Edit sale"
      mobileActions={[
        {
          id: "save",
          label: "Save",
          variant: "primary",
          htmlForm: CATALOG_FORM_IDS.sale,
        },
        {
          id: "cancel",
          label: "Cancel",
          variant: "secondary",
          href: `/admin/sales/${id}`,
        },
      ]}
    >
      <AdminSaleForm
        mode="edit"
        saleId={id}
        saleStatus={sale.status}
        defaultValues={saleToAdminSaleFormValues(sale)}
        categories={categories}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        initialSaleDocuments={saleDocuments}
        previewUrlByKey={previewUrlByKey}
        htmlFormId={CATALOG_FORM_IDS.sale}
      />
    </CatalogFormShell>
  );
}
