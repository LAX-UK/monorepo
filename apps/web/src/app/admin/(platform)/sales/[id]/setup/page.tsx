import { AtgEditAlert } from "@/components/admin/atg/atg-edit-alert";
import { SaleSetupWizard } from "@/components/admin/sale-form/sale-setup-wizard";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { loadAdminSaleSetupPage } from "@/lib/admin/sales/load-sale-setup-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { FormPage } from "@auction/staff-ui";
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
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs
          items={[
            { label: "Sales", href: "/admin/sales" },
            { label: page.sale.title, href: `/admin/sales/${id}` },
            { label: "Setup" },
          ]}
        />
      }
      title="Set up sale"
      description="Each step is saved as you continue. Publish from the last step."
      notice={page.sellingPlatform === "atg" ? <AtgEditAlert saleId={id} /> : null}
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
    </FormPage>
  );
}
