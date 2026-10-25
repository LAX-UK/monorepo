import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminSaleEditPage } from "@/lib/admin/sales/load-sale-edit-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { FormPage } from "@auction/staff-ui";
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
      <FormPage
        breadcrumbs={
          <StaffBreadcrumbs
            items={[
              { label: "Sales", href: "/admin/sales" },
              { label: page.sale.title, href: `/admin/sales/${id}` },
              { label: "Edit" },
            ]}
          />
        }
        title="Edit sale"
        description={
          page.sale.status === "draft"
            ? "Changes apply when you save."
            : "The sale is published, so its schedule, format and buyer's premium are fixed."
        }
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
      </FormPage>
      {children}
    </>
  );
}
