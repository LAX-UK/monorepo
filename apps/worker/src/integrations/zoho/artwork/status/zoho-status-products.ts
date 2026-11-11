import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import type { CrmCoqlQuery, CrmGateway } from "../../../crm/crm-gateway.js";
import { productStatusQuery } from "../coql.js";
import { ZOHO_STATUS_FIELD } from "../writeback-mapping.js";

/** Zoho's COQL takes at most 50 values in one `in` list. */
export const ZOHO_STATUS_BATCH_SIZE = 50;

/** What a Product shows of its Status now. */
export type ZohoStatusState = {
  /** Null when the Product shows no Status. */
  status: string | null;
  /** When the Product last changed in Zoho; null when Zoho did not say. */
  modifiedAt: Date | null;
};

/** Reads and sets the Zoho Products Status. The sync depends on this, not on Zoho. */
export interface ZohoStatusProducts {
  /** What each Product shows now; a Product that no longer exists is absent. */
  read(productIds: readonly string[]): Promise<Map<string, ZohoStatusState>>;
  /** Sets the Status; throws a CrmGatewayError when Zoho refuses. */
  write(productId: string, status: string): Promise<void>;
}

/** Zoho answers these when the data itself is wrong, so sending it again cannot help. */
const NON_RETRYABLE_CODES = new Set([
  "INVALID_DATA",
  "MANDATORY_NOT_FOUND",
  "INVALID_MODULE",
  "DUPLICATE_DATA",
  "NO_PERMISSION",
  "OAUTH_SCOPE_MISMATCH",
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

/** The existing Zoho gateway: COQL for the read, a Products update for the write. */
export class CrmZohoStatusProducts implements ZohoStatusProducts {
  constructor(
    private readonly gateway: Pick<CrmGateway, "updateById">,
    private readonly coql: CrmCoqlQuery,
  ) {}

  async read(productIds: readonly string[]): Promise<Map<string, ZohoStatusState>> {
    const states = new Map<string, ZohoStatusState>();
    for (let at = 0; at < productIds.length; at += ZOHO_STATUS_BATCH_SIZE) {
      const ids = productIds.slice(at, at + ZOHO_STATUS_BATCH_SIZE);
      const page = await this.coql.queryCoql(productStatusQuery(ids));
      for (const row of page.rows) {
        const id = text(row.id);
        if (!id) continue;
        states.set(id, { status: text(row.Status), modifiedAt: time(row.Modified_Time) });
      }
    }
    return states;
  }

  async write(productId: string, status: string): Promise<void> {
    const result = await this.gateway.updateById({
      module: "Products",
      recordId: productId,
      fields: { [ZOHO_STATUS_FIELD]: status },
    });
    if (result.status === "success") return;
    const code = result.code ?? "ERROR";
    throw new CrmGatewayError({
      code,
      message: result.message ?? "product_status_update_failed",
      status: 400,
      retryable: !NON_RETRYABLE_CODES.has(code),
    });
  }
}
