import { parseBidSchema } from "@/lib/data/http/bid.schema";
import { parseLotSchema, parsePublicLotViewSchema } from "@/lib/data/http/lot.schema";
import { parseSaleSchema } from "@/lib/data/http/sale.schema";
import { parseItemSubmissionSchema } from "@/lib/data/http/submissions.schema";
import type { Bid, ItemSubmission, Lot, PublicLotView, Sale } from "@auction/types";

export { coerceToDate, coerceToIsoString } from "./coerce";
export { parseNotificationPreference, parseUserNotification } from "./notifications.parse";
export { parseSessionUser } from "./session.parse";
export { parseKycStatusSummary } from "./kyc.parse";
export { parsePublicUser } from "./users.parse";
export { parseArtistProfile } from "./artist-profile.parse";
export {
  emptyPublicArtistDirectoryFacets,
  parsePublicArtistDirectoryFacets,
  parsePublicArtistDirectoryRow,
} from "./artist-directory.parse";

export function parseSale(raw: unknown): Sale {
  return parseSaleSchema(raw);
}

export function parseLot(raw: unknown): Lot {
  return parseLotSchema(raw);
}

/** Lot detail from public API — withholds reserve amount when `hasReserve` is present. */
export function parseLotDetail(raw: unknown): Lot | PublicLotView {
  return parsePublicLotViewSchema(raw);
}

export function parseItemSubmission(raw: unknown): ItemSubmission {
  return parseItemSubmissionSchema(raw);
}

export function parseBid(raw: unknown): Bid {
  return parseBidSchema(raw);
}
