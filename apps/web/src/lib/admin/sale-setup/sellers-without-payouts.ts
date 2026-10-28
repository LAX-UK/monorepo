import type { CatalogReadinessItem } from "@/lib/admin/catalog-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
import { type SellerWithoutPayouts, sellersWithoutPayouts } from "@auction/domain";

export type NamedSellerWithoutPayouts = SellerWithoutPayouts & { displayName: string };

/**
 * The sellers holding a sale back, named. A seller is blocked when any of their lots is flagged
 * as needing payout setup; their name comes from `nameOf`, with a plain fallback.
 */
export async function nameSellersWithoutPayouts(
  lots: ReadonlyArray<{
    id: string;
    title: string;
    sellerLegalEntityId?: string | null | undefined;
  }>,
  connectRequiredByLotId: ConnectRequiredByLotId,
  nameOf: (sellerLegalEntityId: string) => Promise<string | null>,
): Promise<NamedSellerWithoutPayouts[]> {
  const blockedSellers = new Set(
    lots
      .filter((lot) => connectRequiredByLotId[lot.id] === true && lot.sellerLegalEntityId)
      .map((lot) => lot.sellerLegalEntityId as string),
  );
  const sellers = sellersWithoutPayouts(lots, (id) => !blockedSellers.has(id));
  return Promise.all(
    sellers.map(async (seller) => ({
      ...seller,
      displayName: (await nameOf(seller.sellerLegalEntityId)) ?? "A seller",
    })),
  );
}

/** One checklist line per seller who must set up payouts before the sale goes live. */
export function sellerPayoutsItem(seller: NamedSellerWithoutPayouts): CatalogReadinessItem {
  const count = seller.lots.length;
  return {
    id: `payouts:${seller.sellerLegalEntityId}`,
    label: `${seller.displayName} has not set up payouts (${count} ${count === 1 ? "lot" : "lots"})`,
    ok: false,
    severity: "required",
    href: `/admin/legal-entities/${encodeURIComponent(seller.sellerLegalEntityId)}`,
  };
}
