import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import type { CrmCoqlQuery, CrmGateway } from "../../crm/crm-gateway.js";
import { productWriteStateQuery } from "./coql.js";
import type { ZohoProductState } from "./writeback-mapping.js";
import { PRODUCT_NOT_FOUND, deletedInZoho } from "./zoho-product-gone.js";

/** Reads and updates Zoho Products for the writeback. The service depends on this, not on Zoho. */
export interface ZohoProductWriter {
  /** What Zoho holds now, or null when the Product no longer exists. */
  read(productId: string): Promise<ZohoProductState | null>;
  /** Updates the named fields; throws a CrmGatewayError when Zoho refuses. */
  update(productId: string, fields: Record<string, string>): Promise<void>;
}

/** Zoho answers these when the data itself is wrong, so sending it again cannot help. */
const NON_RETRYABLE_CODES = new Set([
  "INVALID_DATA",
  "MANDATORY_NOT_FOUND",
  "INVALID_MODULE",
  "DUPLICATE_DATA",
  "NO_PERMISSION",
  "OAUTH_SCOPE_MISMATCH",
  PRODUCT_NOT_FOUND,
]);

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Uses the existing Zoho gateway: COQL for the read, a Products update for the write. */
export class CrmZohoProductWriter implements ZohoProductWriter {
  constructor(
    private readonly gateway: Pick<CrmGateway, "updateById">,
    private readonly coql: CrmCoqlQuery,
  ) {}

  async read(productId: string): Promise<ZohoProductState | null> {
    const page = await this.coql.queryCoql(productWriteStateQuery(productId));
    const row = page.rows[0];
    if (!row) return null;
    return { status: text(row.Status), stockCode: text(row.Reference_Stock_Code) };
  }

  async update(productId: string, fields: Record<string, string>): Promise<void> {
    const result = await this.gateway.updateById({
      module: "Products",
      recordId: productId,
      fields,
    });
    if (result.status === "success") return;
    const code = deletedInZoho(result.code) ? PRODUCT_NOT_FOUND : (result.code ?? "ERROR");
    throw new CrmGatewayError({
      code,
      message: result.message ?? "product_update_failed",
      status: 400,
      retryable: !NON_RETRYABLE_CODES.has(code),
    });
  }
}
