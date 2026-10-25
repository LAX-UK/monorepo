import { SaleSetupWizard } from "@/components/admin/sale-form/sale-setup-wizard";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { loadAdminSaleCreatePage } from "@/lib/admin/sales/load-sale-create-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { FormPage } from "@auction/staff-ui";

export default async function AdminNewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ fromSale?: string; step?: string }>;
}) {
  await requireAdminCapability(SALES_ACCESS, "/admin/sales/new");
  const sp = await searchParams;
  const page = await loadAdminSaleCreatePage(sp);

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[{ label: "Sales", href: "/admin/sales" }, { label: "New sale" }]}
        />
      }
      title="New sale"
      description={
        page.cloneFailed
          ? "The sale to copy did not load, so this starts from a blank form."
          : "Set the sale up step by step. Each step is saved as you continue."
      }
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
    </FormPage>
  );
}
