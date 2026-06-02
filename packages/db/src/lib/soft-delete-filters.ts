import { type SQL, isNull } from "drizzle-orm";
import { lot, sale, venue } from "../schema/index.js";

/** Active catalogue rows only — exclude soft-deleted sales. */
export function saleNotDeleted(): SQL {
  return isNull(sale.deletedAt);
}

/** Active catalogue rows only — exclude soft-deleted lots. */
export function lotNotDeleted(): SQL {
  return isNull(lot.deletedAt);
}

/** Active venue rows only — exclude soft-deleted venues. */
export function venueNotDeleted(): SQL {
  return isNull(venue.deletedAt);
}
