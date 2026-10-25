import { AdminLotForm } from "@/components/admin/lot-form";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminLotCreatePage } from "@/lib/admin/lots/load-lot-create-page";
import { FormPage } from "@auction/staff-ui";

type PageProps = { searchParams: Promise<{ fromLot?: string; saleId?: string }> };

export default async function AdminNewLotPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = await loadAdminLotCreatePage(sp);

  return (
    <FormPage
      breadcrumbs={
        <StaffBreadcrumbs items={[{ label: "Lots", href: "/admin/lots" }, { label: "New lot" }]} />
      }
      title="New lot"
      {...(page.description ? { description: page.description } : {})}
    >
      <AdminLotForm
        mode="create"
        defaultValues={page.defaultValues}
        categories={page.categories}
        sales={page.sales}
        artists={page.artists}
        englishOnlyAuctionsLocked={page.englishOnlyAuctionsLocked}
        htmlFormId={CATALOG_FORM_IDS.lot}
        emergencyAddSaleStatus={page.emergencyAddSaleStatus}
      />
    </FormPage>
  );
}
