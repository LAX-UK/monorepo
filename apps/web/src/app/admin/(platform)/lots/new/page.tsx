import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { AdminLotForm } from "@/components/admin/lot-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { loadAdminLotCreatePage } from "@/lib/admin/lots/load-lot-create-page";

type PageProps = { searchParams: Promise<{ fromLot?: string; saleId?: string }> };

export default async function AdminNewLotPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = await loadAdminLotCreatePage(sp);

  return (
    <CatalogFormShell
      layout="wizard"
      breadcrumbs={<CatalogBreadcrumbs segments={[{ label: "Lots", href: "/admin/lots" }]} />}
      title="New lot"
      {...(page.description ? { description: page.description } : {})}
      wizardMobile={{
        formId: CATALOG_FORM_IDS.lot,
        submitLabel: page.emergencyAddSaleStatus ? "Add lot to sale" : "Create draft",
        cancelHref: page.presetSaleId ? `/admin/sales/${page.presetSaleId}/lots` : "/admin/lots",
      }}
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
    </CatalogFormShell>
  );
}
