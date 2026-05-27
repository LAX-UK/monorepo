import { CatalogBreadcrumbs } from "@/components/admin/catalog";
import { CatalogFormShell } from "@/components/admin/catalog/catalog-form-shell";
import { AdminLotForm } from "@/components/admin/lot-form";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { getLotFormAssignableSales } from "@/lib/admin/lot-form-sales";
import { getAdminArtistList, getAdminLotById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  emptyAdminLotFormValues,
  lotToAdminLotFormValues,
} from "@/lib/forms/schemas/admin-lot-defaults";

type PageProps = { searchParams: Promise<{ fromLot?: string }> };

export default async function AdminNewLotPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const fromLotId = (sp.fromLot ?? "").trim();
  const englishOnlyAuctionsLocked = isEnglishOnlyAuctionsLocked();

  let cloneDefaults = emptyAdminLotFormValues();
  let cloneFailed = false;
  if (fromLotId) {
    try {
      const existing = await getAdminLotById(fromLotId);
      if (existing) {
        cloneDefaults = {
          ...lotToAdminLotFormValues(existing),
          title: `${existing.title} (copy)`,
          saleId: "",
          lotNumber: null,
        };
      } else {
        cloneFailed = true;
      }
    } catch {
      cloneFailed = true;
    }
  }
  if (englishOnlyAuctionsLocked && cloneDefaults.auctionType !== "english") {
    cloneDefaults = { ...cloneDefaults, auctionType: "english" };
  }

  const [categoriesResult, salesResult, artistResult] = await Promise.allSettled([
    (async () => (await getServerCategoryReader()).tree())(),
    getLotFormAssignableSales(),
    getAdminArtistList({ includeArchived: false, limit: 200 }),
  ]);
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const sales = salesResult.status === "fulfilled" ? salesResult.value : [];
  const artists = artistResult.status === "fulfilled" ? artistResult.value.rows : [];
  const loadWarnings: string[] = [];
  if (categoriesResult.status === "rejected") loadWarnings.push("category tree");
  if (salesResult.status === "rejected") loadWarnings.push("sales list");
  if (artistResult.status === "rejected") loadWarnings.push("artist list");

  const description = cloneFailed
    ? "Could not load the lot to clone — starting with a blank form."
    : fromLotId
      ? `Cloning catalogue fields from lot ${fromLotId.slice(0, 8)}… Schedule new dates before publishing.`
      : loadWarnings.length > 0
        ? `Some lists could not be loaded (${loadWarnings.join(", ")}). You can still create a draft.`
        : null;

  return (
    <CatalogFormShell
      breadcrumbs={<CatalogBreadcrumbs segments={[{ label: "Lots", href: "/admin/lots" }]} />}
      title="New lot"
      {...(description ? { description } : {})}
      wizardMobile={{
        formId: CATALOG_FORM_IDS.lot,
        submitLabel: "Create draft",
        cancelHref: "/admin/lots",
      }}
    >
      <AdminLotForm
        mode="create"
        defaultValues={cloneDefaults}
        categories={categories}
        sales={sales}
        artists={artists}
        englishOnlyAuctionsLocked={englishOnlyAuctionsLocked}
        htmlFormId={CATALOG_FORM_IDS.lot}
      />
    </CatalogFormShell>
  );
}
