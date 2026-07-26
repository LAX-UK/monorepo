import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { SaleSetupWizard } from "@/components/admin/sale-form/sale-setup-wizard";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminSaleCreatePage } from "@/lib/admin/sales/load-sale-create-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";

export default async function AdminNewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ fromSale?: string; step?: string }>;
}) {
  await requireAdminCapability(SALES_ACCESS, "/admin/sales/new");
  const sp = await searchParams;
  const page = await loadAdminSaleCreatePage(sp);

  return (
    <CatalogFormShell
      layout="wizard"
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Admin", href: "/admin" },
            { label: "Sales", href: "/admin/sales" },
          ]}
        />
      }
      title="New sale"
      description={
        page.cloneFailed
          ? "Could not load the sale to clone — starting with a blank form."
          : "Set up your sale step by step."
      }
      wizardMobile={{
        formId: CATALOG_FORM_IDS.saleSetup,
        submitLabel: "Save & continue",
        cancelHref: "/admin/sales",
      }}
    >
      <SaleSetupWizard
        saleId={null}
        initialStep={page.initialStep}
        defaultValues={page.defaultValues}
        sale={null}
        lots={[]}
        categories={page.categories}
        venues={page.venues}
        artists={page.artists}
        englishOnlyAuctionsLocked={page.englishOnlyAuctionsLocked}
        {...(page.wizardDraftEntityId !== undefined
          ? { wizardDraftEntityId: page.wizardDraftEntityId }
          : {})}
        canManageSale
        canEditCatalog
      />
    </CatalogFormShell>
  );
}
