import type { CrmBatchUpdate, CrmCoqlQuery } from "../../../crm/crm-gateway.js";
import { escapeCoqlString } from "../coql.js";
import {
  CrmZohoListingProducts,
  type ListingUpdateResult,
  ZOHO_LISTING_BATCH_SIZE,
} from "../listing/zoho-listing-products.js";
import { ZOHO_LOCATION_FIELD } from "./zoho-location-fields.js";

/** The `LAX_Location` field on Zoho Products. The sync depends on this, not on Zoho. */
export interface ZohoLocationProducts {
  /** What each Product shows now (null when empty); a Product that no longer exists is absent. */
  read(productIds: readonly string[]): Promise<Map<string, string | null>>;
  /** Writes the field, one result per Product in the order given. */
  update(
    updates: readonly { productId: string; fields: Record<string, string | null> }[],
  ): Promise<ListingUpdateResult[]>;
}

export function productLocationQuery(productIds: readonly string[]): string {
  const ids = productIds.map((id) => `'${escapeCoqlString(id)}'`).join(", ");
  return `select id, ${ZOHO_LOCATION_FIELD} from Products where id in (${ids}) limit ${productIds.length}`;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * COQL for the read and one batched update for the writes, through the shared Zoho stack. The
 * write and its error handling are the listing's: same module, same batch, same Zoho answers.
 */
export class CrmZohoLocationProducts implements ZohoLocationProducts {
  private readonly writer: CrmZohoListingProducts;

  constructor(private readonly gateway: CrmCoqlQuery & CrmBatchUpdate) {
    this.writer = new CrmZohoListingProducts(gateway);
  }

  async read(productIds: readonly string[]): Promise<Map<string, string | null>> {
    const shown = new Map<string, string | null>();
    for (let at = 0; at < productIds.length; at += ZOHO_LISTING_BATCH_SIZE) {
      const ids = productIds.slice(at, at + ZOHO_LISTING_BATCH_SIZE);
      const page = await this.gateway.queryCoql(productLocationQuery(ids));
      for (const row of page.rows) {
        const id = text(row.id);
        if (id) shown.set(id, text(row[ZOHO_LOCATION_FIELD]));
      }
    }
    return shown;
  }

  update(
    updates: readonly { productId: string; fields: Record<string, string | null> }[],
  ): Promise<ListingUpdateResult[]> {
    return this.writer.update(updates);
  }
}
