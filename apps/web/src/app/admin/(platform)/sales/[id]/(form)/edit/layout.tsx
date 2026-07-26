import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminSaleEditPage } from "@/lib/admin/sales/load-sale-edit-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminEditSaleLayout({ params, children }: Props) {
  const { id } = await params;
  await requireAdminCapability(SALES_ACCESS, `/admin/sales/${id}/edit`);
  const page = await loadAdminSaleEditPage(id);

  return (
    <>
      <CatalogFormShell
        layout="wizard"
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[
              { label: "Admin", href: "/admin" },
              { label: "Sales", href: "/admin/sales" },
              { label: page.sale.title, href: `/admin/sales/${id}` },
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
          saleStatus={page.sale.status}
          defaultValues={page.defaultValues}
          categories={page.categories}
          englishOnlyAuctionsLocked={page.englishOnlyAuctionsLocked}
          initialSaleDocuments={page.saleDocuments}
          previewUrlByKey={page.previewUrlByKey}
          htmlFormId={CATALOG_FORM_IDS.sale}
          lots={page.lots}
        />
      </CatalogFormShell>
      {children}
    </>
  );
}
