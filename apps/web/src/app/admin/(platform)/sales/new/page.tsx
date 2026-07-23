import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { SaleSetupWizard } from "@/components/admin/sale-form/sale-setup-wizard";
import { firstString } from "@/lib/admin/admin-list-params";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import type { SaleSetupStepId } from "@/lib/admin/sale-setup";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { getAdminArtistList } from "@/lib/data/http/admin.server";
import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { resolvePlatformCatalogLegalEntity } from "@/lib/data/http/platform-catalog.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  emptyAdminSaleFormValues,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";

export default async function AdminNewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ fromSale?: string; step?: string }>;
}) {
  await requireAdminCapability(SALES_ACCESS, "/admin/sales/new");
  const sp = await searchParams;
  const categories = await (await getServerCategoryReader()).tree();
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();
  const cloneFromId = firstString(sp.fromSale)?.trim();
  const stepRaw = firstString(sp.step)?.trim() as SaleSetupStepId | undefined;
  const initialStep = stepRaw ?? "identity";

  let defaultValues = emptyAdminSaleFormValues();
  let wizardDraftEntityId: string | undefined;
  let cloneFailed = false;

  if (cloneFromId) {
    wizardDraftEntityId = `clone-${cloneFromId}`;
    const bundle = await getAdminSaleById(cloneFromId).catch(() => null);
    if (bundle?.sale) {
      const fromForm = saleToAdminSaleFormValues(bundle.sale);
      defaultValues = {
        ...fromForm,
        title: fromForm.title.trim() ? `${fromForm.title.trim()} (copy)` : "",
      };
    } else {
      cloneFailed = true;
    }
  }

  const artists = await getAdminArtistList({ includeArchived: false, limit: 200 })
    .then((r) => r.rows)
    .catch(() => []);
  const platformCatalog = await resolvePlatformCatalogLegalEntity();
  const venues = platformCatalog.ok
    ? await getWriteContainer()
        .adminVenues.list({ legalEntityId: platformCatalog.id, limit: 100 })
        .then((r) => (r.ok ? r.data.venues : []))
        .catch(() => [])
    : [];

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
        cloneFailed
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
        initialStep={initialStep}
        defaultValues={defaultValues}
        sale={null}
        lots={[]}
        categories={categories}
        venues={venues}
        artists={artists}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        {...(wizardDraftEntityId !== undefined ? { wizardDraftEntityId } : {})}
        canManageSale
        canEditCatalog
      />
    </CatalogFormShell>
  );
}
