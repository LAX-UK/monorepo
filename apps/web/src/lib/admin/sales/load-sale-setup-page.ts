import "server-only";

import { loadSaleSellersWithoutPayouts } from "@/lib/admin/connect-readiness";
import type { NamedSellerWithoutPayouts } from "@/lib/admin/sale-setup/sellers-without-payouts";

import { firstString } from "@/lib/admin/admin-list-params";
import { connectRequiredFromLots } from "@/lib/admin/connect-readiness";
import {
  loadAdminSaleDetail,
  loadAdminSalePendingRegistrationCount,
} from "@/lib/admin/load-sale-detail";
import { type SaleSetupStepId, resolveFirstIncompleteStep } from "@/lib/admin/sale-setup";
import { getAdminArtistList } from "@/lib/data/http/admin.server";
import { getAtgSaleSellingPlatform } from "@/lib/data/http/atg.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  buildCoverImagePreviewMap,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { LOTS_ACCESS, SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import type {
  ArtistProfile,
  AtgOwnershipState,
  CategoryNode,
  Lot,
  Sale,
  StaffRoles,
  UserRole,
} from "@auction/types";
import { userHasAccessTo } from "@auction/types";

import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";

export type SaleSetupPageModel = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  redirectTo: string | null;
  initialStep: SaleSetupStepId;
  defaultValues: AdminSaleFormValues;
  previewUrlByKey: Record<string, string>;
  categories: CategoryNode[];
  venues: AdminVenueListRow[];
  artists: ArtistProfile[];
  englishOnlyAuctionsLocked: boolean;
  canManageSale: boolean;
  canEditCatalog: boolean;
  pendingRegistrationCount: number | null;
  connectRequiredByLotId: Record<string, boolean>;
  /** Sellers who must set up payouts before the sale can go live, each once by name. */
  sellersWithoutPayouts: NamedSellerWithoutPayouts[];
  /** Set while ATG sync is on and the viewer manages sales; "atg" shows the edit alert. */
  sellingPlatform: AtgOwnershipState | null;
};

type LoadSaleSetupPageInput = {
  saleId: string;
  step?: string | undefined;
  role: UserRole;
  staffRoles: StaffRoles | undefined;
};

/** Data/composition boundary for `/admin/sales/[id]/setup`. */
export async function loadAdminSaleSetupPage({
  saleId,
  step,
  role,
  staffRoles,
}: LoadSaleSetupPageInput): Promise<SaleSetupPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const { sale, lots } = bundle;

  const redirectTo =
    sale.status !== "draft"
      ? `/admin/sales/${saleId}?error=${encodeURIComponent("Setup is only available for draft sales")}`
      : null;

  const stepParam = firstString(step)?.trim() as SaleSetupStepId | undefined;

  const canManageSale = userHasAccessTo(role, staffRoles, SALES_ACCESS);
  const [
    categories,
    artistResult,
    venuesResult,
    pendingRegistrationCount,
    connectRequiredByLotId,
    sellingPlatform,
  ] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getAdminArtistList({ includeArchived: false, limit: 200 }).catch(() => ({ rows: [] })),
    getWriteContainer()
      .adminVenues.list({
        ...(sale.createdByLegalEntityId ? { legalEntityId: sale.createdByLegalEntityId } : {}),
      })
      .catch(() => ({ ok: true as const, data: { venues: [], total: 0 }, status: 200 })),
    loadAdminSalePendingRegistrationCount(saleId, sale),
    Promise.resolve(connectRequiredFromLots(lots)),
    canManageSale ? getAtgSaleSellingPlatform(sale) : Promise.resolve(null),
  ]);

  const initialStep =
    stepParam ??
    resolveFirstIncompleteStep({
      sale,
      lots,
      pendingRegistrationCount,
      connectRequiredByLotId,
    });

  const sellersWithoutPayouts = await loadSaleSellersWithoutPayouts(lots, connectRequiredByLotId);
  const defaultValues = saleToAdminSaleFormValues(sale);
  const saleWithCovers = bundle.sale as typeof sale & { coverImagePresentedUrls?: string[] };
  const previewUrlByKey = buildCoverImagePreviewMap(
    sale.coverImages,
    saleWithCovers.coverImagePresentedUrls ?? [],
  );

  return {
    saleId,
    sale,
    lots,
    redirectTo,
    initialStep,
    defaultValues,
    previewUrlByKey,
    categories,
    venues: venuesResult.ok ? venuesResult.data.venues : [],
    artists: artistResult.rows,
    englishOnlyAuctionsLocked: isEnglishOnlyAuctionsLocked(),
    canManageSale,
    canEditCatalog: userHasAccessTo(role, staffRoles, LOTS_ACCESS),
    pendingRegistrationCount,
    connectRequiredByLotId,
    sellersWithoutPayouts,
    sellingPlatform,
  };
}
