import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { SaleSetupWizard } from "@/components/admin/sale-form/sale-setup-wizard";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminSaleSetupPage } from "@/lib/admin/sales/load-sale-setup-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import type { UserRole } from "@auction/types";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
};

export default async function AdminSaleSetupPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireAdminCapability(LOTS_ACCESS, `/admin/sales/${id}/setup`);

  const page = await loadAdminSaleSetupPage({
    saleId: id,
    step: sp.step,
    role: user.role as UserRole,
    staffRole: user.staffRole ?? null,
  });

  if (page.redirectTo) {
    redirect(page.redirectTo);
  }

  return (
    <CatalogFormShell
      layout="wizard"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Sales", href: "/admin/sales" },
            { label: page.sale.title, href: `/admin/sales/${id}` },
            { label: "Setup" },
          ]}
        />
      }
      title="Set up sale"
      description="Complete each step to publish your sale."
      wizardMobile={{
        formId: CATALOG_FORM_IDS.saleSetup,
        submitLabel: "Save & continue",
        cancelHref: `/admin/sales/${id}`,
      }}
    >
      <SaleSetupWizard
        saleId={id}
        initialStep={page.initialStep}
        defaultValues={page.defaultValues}
        sale={page.sale}
        lots={page.lots}
        categories={page.categories}
        venues={page.venues}
        artists={page.artists}
        englishOnlyAuctionsLocked={page.englishOnlyAuctionsLocked}
        previewUrlByKey={page.previewUrlByKey}
        canManageSale={page.canManageSale}
        canEditCatalog={page.canEditCatalog}
        pendingRegistrationCount={page.pendingRegistrationCount}
        connectRequiredByLotId={page.connectRequiredByLotId}
      />
    </CatalogFormShell>
  );
}
