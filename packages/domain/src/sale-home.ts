import { SALE_FEATURED_LOTS_MAX, SALE_HOME_PINS_MAX, type SaleStatus } from "@auction/types";

/** Only a sale people can see can lead the home page. */
const PINNABLE_STATUSES: readonly SaleStatus[] = ["scheduled", "active", "ended"];

export function canPinToHome(status: SaleStatus): boolean {
  return PINNABLE_STATUSES.includes(status);
}

export type FeaturedLotsRefusal =
  | { code: "too_many"; max: number }
  | { code: "duplicate"; lotId: string }
  | { code: "not_in_sale"; lotId: string };

/** Featured lots must be distinct, at most twelve, and belong to the sale. */
export function featuredLotsRefusal(
  lotIds: readonly string[],
  lotIdsInSale: ReadonlySet<string>,
): FeaturedLotsRefusal | null {
  if (lotIds.length > SALE_FEATURED_LOTS_MAX) {
    return { code: "too_many", max: SALE_FEATURED_LOTS_MAX };
  }
  const seen = new Set<string>();
  for (const lotId of lotIds) {
    if (seen.has(lotId)) return { code: "duplicate", lotId };
    seen.add(lotId);
    if (!lotIdsInSale.has(lotId)) return { code: "not_in_sale", lotId };
  }
  return null;
}

export type HomePinsRefusal =
  | { code: "too_many"; max: number }
  | { code: "duplicate"; saleId: string }
  | { code: "not_pinnable"; saleId: string };

/** The ordered pins for the home page: at most three, each once, each a visible sale. */
export function homePinsRefusal(
  saleIds: readonly string[],
  statusOf: (saleId: string) => SaleStatus | undefined,
): HomePinsRefusal | null {
  if (saleIds.length > SALE_HOME_PINS_MAX) return { code: "too_many", max: SALE_HOME_PINS_MAX };
  const seen = new Set<string>();
  for (const saleId of saleIds) {
    if (seen.has(saleId)) return { code: "duplicate", saleId };
    seen.add(saleId);
    const status = statusOf(saleId);
    if (status === undefined || !canPinToHome(status)) return { code: "not_pinnable", saleId };
  }
  return null;
}
