import "server-only";

import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";

export type LotImagesPageModel = {
  lotId: string;
  images: string[];
  imageAlts: string[];
};

/** Data/composition boundary for `/admin/lots/[id]/images`. */
export async function loadAdminLotImagesPage(lotId: string): Promise<LotImagesPageModel> {
  const { auction } = await loadAdminLotDetail(lotId);

  return {
    lotId,
    images: auction.images,
    imageAlts: (auction.marketingDetails.imageAlts ?? []).map((alt) => alt ?? ""),
  };
}
