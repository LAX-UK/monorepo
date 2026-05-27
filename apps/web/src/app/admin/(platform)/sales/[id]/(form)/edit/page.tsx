import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  buildCoverImagePreviewMap,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notFound } from "next/navigation";

export default async function AdminEditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}/edit`);
  const [bundle, categories] = await Promise.all([
    getAdminSaleById(id),
    (async () => (await getServerCategoryReader()).tree())(),
  ]);
  if (!bundle) notFound();
  const { sale, lots } = bundle;
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
        <CatalogBreadcrumbs
          segments={[
            { label: "Sales", href: "/admin/sales" },
            { label: sale.title, href: `/admin/sales/${id}` },
            { label: "Edit" },
          ]}
        />
      }
      title="Edit sale"
      wizardMobile={{
        formId: CATALOG_FORM_IDS.sale,
        submitLabel: "Save",
        cancelHref: `/admin/sales/${id}`,
      }}
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
        lots={lots}
      />
    </CatalogFormShell>
  );
}
