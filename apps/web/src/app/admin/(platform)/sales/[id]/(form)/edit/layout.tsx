import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  buildCoverImagePreviewMap,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminEditSaleLayout({ params, children }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}/edit`);
  const bundle = await loadAdminSaleDetail(id);
  const { sale, lots } = bundle;
  const [categories, saleDocuments] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getServerSaleDocuments(id),
  ]);
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  const previewUrlByKey = buildCoverImagePreviewMap(
    sale.coverImages,
    "coverImagePresentedUrls" in sale
      ? (sale as { coverImagePresentedUrls?: string[] }).coverImagePresentedUrls
      : undefined,
  );

  return (
    <>
      <CatalogFormShell
        layout="wizard"
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[
              { label: "Admin", href: "/admin" },
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
          alwaysShowSubmit: true,
        }}
      >
        <AdminSaleForm
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
      {children}
    </>
  );
}
