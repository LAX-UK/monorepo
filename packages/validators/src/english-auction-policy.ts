import type { LotAuctionType } from "@auction/types";

/**
 * English-only catalogue mode (`ENGLISH_ONLY_AUCTIONS`, default true in API env): product and API rules treat the
 * catalogue as English-auction-first (bid placement and admin forms gate non-English types).
 * Staff must not assign new non-English auction types; existing non-English rows may remain
 * until deliberately migrated to `english`.
 */
export function englishOnlyAdminLotAuctionTypeViolation(opts: {
  enabled: boolean;
  existing?: LotAuctionType;
  requested?: LotAuctionType;
}): string | null {
  if (!opts.enabled) return null;
  const { existing, requested } = opts;
  if (requested === undefined) return null;
  if (requested === "english") return null;
  if (existing !== undefined && existing === requested) return null;
  return "While English-only mode is enabled, catalogue work must use the English auction type. You can keep an existing non-English type until you migrate it to English.";
}
