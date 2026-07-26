import "server-only";

import { loadAdminLotRecord } from "@/lib/admin/load-lot-detail";
import { getLotFormAssignableSales } from "@/lib/admin/lot-form-sales";
import { getAdminArtistList } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotDocuments } from "@/lib/data/http/lot-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { lotToAdminLotFormValues } from "@/lib/forms/schemas/admin-lot-defaults";
import type { AdminLotFormValues } from "@/lib/forms/schemas/admin-lot-form";
import type { ArtistProfile, CategoryNode, EntityDocument, Lot, Sale } from "@auction/types";

type AssignableSale = Pick<
  Sale,
  "id" | "title" | "status" | "deliveryMode" | "startTime" | "endTime"
>;

export type LotEditPageModel = {
  lotId: string;
  auction: Lot;
  redirectTo: string | null;
  categories: CategoryNode[];
  sales: AssignableSale[];
  artists: ArtistProfile[];
  lotDocuments: EntityDocument[];
  defaultValues: AdminLotFormValues;
  isDraft: boolean;
  canEditCore: boolean;
  englishOnlyAuctionsLocked: boolean;
};

/** Data/composition boundary for `/admin/lots/[id]/edit`. */
export async function loadAdminLotEditPage(lotId: string): Promise<LotEditPageModel> {
  const auction = await loadAdminLotRecord(lotId);

  const redirectTo =
    auction.status === "ended" || auction.status === "cancelled" || auction.status === "voided"
      ? `/admin/lots/${lotId}`
      : null;

  const [categories, salesResult, artistList, lotDocuments] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getLotFormAssignableSales(auction?.saleId).catch(() => getLotFormAssignableSales()),
    getAdminArtistList({ includeArchived: false, limit: 200 }),
    getServerLotDocuments(lotId),
  ]);

  const isDraft = auction.status === "draft";
  const canEditCore = isDraft || auction.status === "scheduled";

  return {
    lotId,
    auction,
    redirectTo,
    categories,
    sales: salesResult.sales,
    artists: artistList.rows,
    lotDocuments,
    defaultValues: lotToAdminLotFormValues(auction),
    isDraft,
    canEditCore,
    englishOnlyAuctionsLocked: isEnglishOnlyAuctionsLocked(),
  };
}
