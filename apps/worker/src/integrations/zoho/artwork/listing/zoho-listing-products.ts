import type { CrmBatchUpdate, CrmCoqlQuery, CrmFieldValue } from "../../../crm/crm-gateway.js";
import { escapeCoqlString } from "../coql.js";
import { PRODUCT_NOT_FOUND, deletedInZoho } from "../zoho-product-gone.js";
import { ZOHO_LISTING_FIELDS, type ZohoListingState } from "./zoho-listing-fields.js";

/** Zoho's COQL takes at most 50 values in one `in` list. */
export const ZOHO_LISTING_BATCH_SIZE = 50;

export type ListingUpdateResult =
  | { productId: string; ok: true }
  | { productId: string; ok: false; code: string; retryable: boolean };

/** The listing fields on Zoho Products. The sync depends on this, not on Zoho. */
export interface ZohoListingProducts {
  /** What each Product shows now; a Product that no longer exists is absent. */
  read(productIds: readonly string[]): Promise<Map<string, ZohoListingState>>;
  /** Writes the fields, one result per Product in the order given. */
  update(
    updates: readonly { productId: string; fields: Record<string, string | null> }[],
  ): Promise<ListingUpdateResult[]>;
}

/** Zoho answers these when the data itself is wrong, so sending it again cannot help. */
export const NON_RETRYABLE_CODES = new Set([
  "INVALID_DATA",
  "MANDATORY_NOT_FOUND",
  "INVALID_MODULE",
  "DUPLICATE_DATA",
  "NO_PERMISSION",
  "OAUTH_SCOPE_MISMATCH",
  "ID_INVALID",
  "RECORD_NOT_FOUND",
  "product_not_found",
]);

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function time(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function productListingQuery(productIds: readonly string[]): string {
  const ids = productIds.map((id) => `'${escapeCoqlString(id)}'`).join(", ");
  const fields = ["id", ...Object.values(ZOHO_LISTING_FIELDS)].join(", ");
  return `select ${fields} from Products where id in (${ids}) limit ${productIds.length}`;
}

/** COQL for the read and one batched update for the writes, through the shared Zoho stack. */
export class CrmZohoListingProducts implements ZohoListingProducts {
  constructor(private readonly gateway: CrmCoqlQuery & CrmBatchUpdate) {}

  async read(productIds: readonly string[]): Promise<Map<string, ZohoListingState>> {
    const states = new Map<string, ZohoListingState>();
    for (let at = 0; at < productIds.length; at += ZOHO_LISTING_BATCH_SIZE) {
      const ids = productIds.slice(at, at + ZOHO_LISTING_BATCH_SIZE);
      const page = await this.gateway.queryCoql(productListingQuery(ids));
      for (const row of page.rows) {
        const id = text(row.id);
        if (!id) continue;
        states.set(id, {
          value: text(row[ZOHO_LISTING_FIELDS.value]),
          detail: text(row[ZOHO_LISTING_FIELDS.detail]),
          link: text(row[ZOHO_LISTING_FIELDS.link]),
          updatedAt: time(row[ZOHO_LISTING_FIELDS.updated]),
        });
      }
    }
    return states;
  }

  async update(
    updates: readonly { productId: string; fields: Record<string, string | null> }[],
  ): Promise<ListingUpdateResult[]> {
    const results: ListingUpdateResult[] = [];
    for (let at = 0; at < updates.length; at += ZOHO_LISTING_BATCH_SIZE) {
      const batch = updates.slice(at, at + ZOHO_LISTING_BATCH_SIZE);
      const rows = await this.gateway.updateMany({
        module: "Products",
        records: batch.map((update) => ({
          id: update.productId,
          ...(update.fields as Record<string, CrmFieldValue>),
        })),
      });
      for (const [index, update] of batch.entries()) {
        const row = rows[index];
        if (row?.status === "success") {
          results.push({ productId: update.productId, ok: true });
          continue;
        }
        const code = deletedInZoho(row?.code) ? PRODUCT_NOT_FOUND : (row?.code ?? "EMPTY_RESPONSE");
        results.push({
          productId: update.productId,
          ok: false,
          code,
          retryable: !NON_RETRYABLE_CODES.has(code),
        });
      }
    }
    return results;
  }
}
