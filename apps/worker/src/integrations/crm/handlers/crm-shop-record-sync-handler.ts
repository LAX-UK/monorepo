import { CrmGatewayError } from "../crm-gateway-error.js";
import type { CrmGateway } from "../crm-gateway.js";
import type { CrmSyncResult } from "../crm-sync-result.js";

export type ShopArtworkProductUpsertIntent = {
  aggregateId: string;
  importKey: string;
  slug: string;
  eligibleForEditionAllocation: boolean;
};

export type ShopOrderPaidFinancialsIntent = {
  orderId: string;
  identitySubjectId: string;
  totalPence: number;
  paidAt: string;
};

export type CrmShopRecordSyncHandlerDeps = {
  gateway: CrmGateway;
  catalogueSyncEnabled: boolean;
  financialsSyncEnabled: boolean;
};

export class CrmShopRecordSyncHandler {
  constructor(private readonly deps: CrmShopRecordSyncHandlerDeps) {}

  async syncArtworkCreated(intent: ShopArtworkProductUpsertIntent): Promise<CrmSyncResult> {
    if (!this.deps.catalogueSyncEnabled) {
      return { outcome: "skipped", reason: "shop_zoho_catalogue_sync_disabled" };
    }

    const productResult = await this.deps.gateway.upsert({
      module: "Products",
      fields: {
        Product_Name: intent.slug,
        Product_Code: intent.importKey,
        LAX_Shop_Artwork_Id: intent.aggregateId,
        LAX_Eligible_For_Editions: intent.eligibleForEditionAllocation,
      },
      duplicateCheckFields: ["Product_Code"],
    });

    if (productResult.status !== "success" || !productResult.recordId) {
      const code = productResult.code ?? "product_upsert_failed";
      const nonRetryable = ["INVALID_DATA", "MANDATORY_NOT_FOUND", "INVALID_MODULE"].includes(code);
      return {
        outcome: nonRetryable ? "fatal" : "retry",
        error: new CrmGatewayError({
          code,
          message: productResult.message ?? "Product upsert failed",
          status: 502,
          retryable: !nonRetryable,
        }),
      };
    }

    return { outcome: "success", providerReference: productResult.recordId };
  }

  /** Zoho financials upsert keyed by shop order id (idempotent). Gated until module is provisioned. */
  async syncOrderPaidFinancials(intent: ShopOrderPaidFinancialsIntent): Promise<CrmSyncResult> {
    if (!this.deps.financialsSyncEnabled) {
      return { outcome: "skipped", reason: "shop_zoho_financials_sync_disabled" };
    }
    void intent;
    return { outcome: "skipped", reason: "shop_zoho_transactions_module_not_available" };
  }
}
