import "server-only";

import { getPublicLotPremiumTerms } from "@/lib/data/http/public-catalogue.server";
import type { BuyersPremiumTerms } from "@auction/domain";

/**
 * What the lot template reads beyond the lot, as everyone sees it (CO-7): the premium terms only.
 * No bid state is read for the page (price, next bid, status, close, history, leader): the page
 * HTML is built from cached reads, so the browser reads those live and fills the placeholders.
 */
export async function loadPublicLotTemplateReads(lotId: string): Promise<{
  buyersPremium: BuyersPremiumTerms | null;
}> {
  return { buyersPremium: await getPublicLotPremiumTerms(lotId) };
}
