import { describe, expect, it, vi } from "vitest";
import type { CrmGateway } from "../crm-gateway.js";
import { CrmShopRecordSyncHandler } from "./crm-shop-record-sync-handler.js";

describe("CrmShopRecordSyncHandler", () => {
  it("skips artwork product upsert when catalogue sync is disabled", async () => {
    const handler = new CrmShopRecordSyncHandler({
      gateway: {} as CrmGateway,
      catalogueSyncEnabled: false,
    });
    const result = await handler.syncArtworkCreated({
      aggregateId: "00000000-0000-4000-8000-000000000001",
      importKey: "key-1",
      slug: "slug-1",
      eligibleForEditionAllocation: true,
    });
    expect(result).toEqual({ outcome: "skipped", reason: "shop_zoho_catalogue_sync_disabled" });
  });

  it("upserts Products when catalogue sync is enabled", async () => {
    const upsert = vi.fn().mockResolvedValue({
      module: "Products",
      recordId: "zoho-product-1",
      action: "upsert",
      status: "success",
    });
    const handler = new CrmShopRecordSyncHandler({
      gateway: { upsert } as unknown as CrmGateway,
      catalogueSyncEnabled: true,
    });
    const result = await handler.syncArtworkCreated({
      aggregateId: "00000000-0000-4000-8000-000000000001",
      importKey: "key-1",
      slug: "slug-1",
      eligibleForEditionAllocation: true,
    });
    expect(result).toEqual({ outcome: "success", providerReference: "zoho-product-1" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Products",
        duplicateCheckFields: ["Product_Code"],
      }),
    );
  });

  it("returns retryable CrmGatewayError when product upsert fails", async () => {
    const upsert = vi.fn().mockResolvedValue({
      module: "Products",
      action: "upsert",
      status: "error",
      code: "RATE_LIMIT",
      message: "rate limited",
    });
    const handler = new CrmShopRecordSyncHandler({
      gateway: { upsert } as unknown as CrmGateway,
      catalogueSyncEnabled: true,
    });
    const result = await handler.syncArtworkCreated({
      aggregateId: "00000000-0000-4000-8000-000000000001",
      importKey: "key-1",
      slug: "slug-1",
      eligibleForEditionAllocation: true,
    });
    expect(result.outcome).toBe("retry");
    if (result.outcome === "retry") {
      const err = result.error as { name?: string; retryable?: boolean };
      expect(err.name).toBe("CrmGatewayError");
      expect(err.retryable).toBe(true);
    }
  });
});
