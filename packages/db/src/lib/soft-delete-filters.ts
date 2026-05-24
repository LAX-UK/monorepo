import { type SQL, isNull } from "drizzle-orm";
import { lot, sale } from "../schema/index.js";

/** Active catalogue rows only — exclude soft-deleted sales. */
export function saleNotDeleted(): SQL {
  return isNull(sale.deletedAt);
}

/** Active catalogue rows only — exclude soft-deleted lots. */
export function lotNotDeleted(): SQL {
  return isNull(lot.deletedAt);
}
