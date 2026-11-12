import { describe, expect, it, vi } from "vitest";
import type { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import { productWriteStateQuery } from "./coql.js";
import { CrmZohoProductWriter } from "./zoho-product-writer.js";

function setup(rows: Record<string, unknown>[] = []) {
  const gateway = {
    updateById: vi.fn(async () => ({
      module: "Products" as const,
      recordId: "1",
      action: "update" as const,
      status: "success" as const,
    })),
  };
  const coql = { queryCoql: vi.fn(async () => ({ rows, moreRecords: false })) };
  return { gateway, coql, writer: new CrmZohoProductWriter(gateway, coql) };
}

describe("productWriteStateQuery", () => {
  it("selects the stock code LAX writes for one Product, escaping the id", () => {
    expect(productWriteStateQuery("1' or '1'='1")).toBe(
      "select id, Reference_Stock_Code from Products where id = '1\\' or \\'1\\'=\\'1' limit 1",
    );
  });
});

describe("CrmZohoProductWriter", () => {
  it("reads the stock code, treating blanks as none", async () => {
    const { writer, coql } = setup([{ id: "1", Reference_Stock_Code: " " }]);
    expect(await writer.read("1")).toEqual({ stockCode: null });
    expect(coql.queryCoql).toHaveBeenCalledWith(productWriteStateQuery("1"));
  });

  it("returns null for a Product Zoho does not have", async () => {
    expect(await setup([]).writer.read("1")).toBeNull();
  });

  it("updates the Products module by id", async () => {
    const { writer, gateway } = setup();
    await writer.update("1", { Status: "Sold" });
    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Products",
      recordId: "1",
      fields: { Status: "Sold" },
    });
  });

  it("throws a non-retryable error when Zoho refuses the data", async () => {
    const { writer, gateway } = setup();
    gateway.updateById.mockResolvedValue({
      module: "Products",
      recordId: "1",
      action: "update",
      status: "error",
      code: "INVALID_DATA",
      message: "picklist value",
    } as never);
    const error = (await writer.update("1", { Status: "Nope" }).catch((e) => e)) as CrmGatewayError;
    expect(error.code).toBe("INVALID_DATA");
    expect(error.retryable).toBe(false);
  });

  it("throws a non-retryable product_not_found when the Product was deleted in Zoho", async () => {
    const { writer, gateway } = setup();
    gateway.updateById.mockResolvedValue({
      module: "Products",
      recordId: "1",
      action: "update",
      status: "error",
      code: "RECORD_NOT_FOUND",
      message: "gone",
    } as never);
    const error = (await writer.update("1", { Status: "Sold" }).catch((e) => e)) as CrmGatewayError;
    expect(error.code).toBe("product_not_found");
    expect(error.retryable).toBe(false);
  });

  it("throws a retryable error for any other refusal", async () => {
    const { writer, gateway } = setup();
    gateway.updateById.mockResolvedValue({
      module: "Products",
      recordId: "1",
      action: "update",
      status: "error",
      code: "SERVICE_UNAVAILABLE",
    } as never);
    const error = (await writer.update("1", { Status: "Sold" }).catch((e) => e)) as CrmGatewayError;
    expect(error.retryable).toBe(true);
  });
});
