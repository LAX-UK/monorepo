import "server-only";

import { firstString } from "@/lib/admin/admin-list-params";
import type { SaleSetupStepId } from "@/lib/admin/sale-setup";
import { getAdminArtistList, getAdminSaleById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { resolvePlatformCatalogLegalEntity } from "@/lib/data/http/platform-catalog.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  emptyAdminSaleFormValues,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { ArtistProfile, CategoryNode } from "@auction/types";

import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";

export type SaleCreatePageModel = {
  categories: CategoryNode[];
  englishOnlyAuctionsLocked: boolean;
  defaultValues: AdminSaleFormValues;
  wizardDraftEntityId?: string;
  cloneFailed: boolean;
  initialStep: SaleSetupStepId;
  artists: ArtistProfile[];
  venues: AdminVenueListRow[];
};

type LoadSaleCreatePageInput = {
  fromSale?: string;
  step?: string;
};

/** Data/composition boundary for `/admin/sales/new`. */
export async function loadAdminSaleCreatePage(
  input: LoadSaleCreatePageInput = {},
): Promise<SaleCreatePageModel> {
  const cloneFromId = firstString(input.fromSale)?.trim();
  const stepRaw = firstString(input.step)?.trim() as SaleSetupStepId | undefined;
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

  const [categories, artists, platformCatalog] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminArtistList({ includeArchived: false, limit: 200 })
      .then((r) => r.rows)
      .catch(() => [] as ArtistProfile[]),
    resolvePlatformCatalogLegalEntity(),
  ]);

  const venues = platformCatalog.ok
    ? await getWriteContainer()
        .adminVenues.list({ legalEntityId: platformCatalog.id, limit: 100 })
        .then((r) => (r.ok ? r.data.venues : []))
        .catch(() => [] as AdminVenueListRow[])
    : [];

  return {
    categories,
    englishOnlyAuctionsLocked: isEnglishOnlyAuctionsLocked(),
    defaultValues,
    ...(wizardDraftEntityId !== undefined ? { wizardDraftEntityId } : {}),
    cloneFailed,
    initialStep,
    artists,
    venues,
  };
}
