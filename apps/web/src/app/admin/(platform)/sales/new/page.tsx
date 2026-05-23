import { AdminSaleForm } from "@/components/admin/admin-sale-form";
import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { firstString } from "@/lib/admin/admin-list-params";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  emptyAdminSaleFormValues,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";

export default async function AdminNewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ fromSale?: string }>;
}) {
  const sp = await searchParams;
  const categories = await (await getServerCategoryReader()).tree();
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();
  const cloneFromId = firstString(sp.fromSale)?.trim();

  let defaultValues = emptyAdminSaleFormValues();
  let wizardDraftEntityId: string | undefined;

  if (cloneFromId) {
    wizardDraftEntityId = `clone-${cloneFromId}`;
    const bundle = await getAdminSaleById(cloneFromId).catch(() => null);
    if (bundle?.sale) {
      const fromForm = saleToAdminSaleFormValues(bundle.sale);
      defaultValues = {
        ...fromForm,
        title: fromForm.title.trim() ? `${fromForm.title.trim()} (copy)` : "",
      };
    }
  }

  return (
    <CatalogFormShell
      breadcrumbs={<CatalogBreadcrumbs segments={[{ label: "Sales", href: "/admin/sales" }]} />}
      title="New sale"
      wizardMobile={{
        formId: CATALOG_FORM_IDS.sale,
        submitLabel: "Create draft sale",
        cancelHref: "/admin/sales",
      }}
    >
      <AdminSaleForm
        mode="create"
        defaultValues={defaultValues}
        categories={categories}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        {...(wizardDraftEntityId !== undefined ? { wizardDraftEntityId } : {})}
        htmlFormId={CATALOG_FORM_IDS.sale}
      />
    </CatalogFormShell>
  );
}
