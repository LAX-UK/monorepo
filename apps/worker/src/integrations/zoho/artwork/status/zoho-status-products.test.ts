import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import { productStatusQuery } from "../coql.js";
import { CrmZohoStatusProducts, ZOHO_STATUS_BATCH_SIZE } from "./zoho-status-products.js";

function setup(
  rows: Record<string, unknown>[] = [],
  result: Record<string, unknown> = { status: "success" },
) {
  const gateway = { updateById: vi.fn(async () => result as never) };
  const coql = { queryCoql: vi.fn(async () => ({ rows, moreRecords: false })) };
  return { gateway, coql, products: new CrmZohoStatusProducts(gateway, coql) };
}

describe("productStatusQuery", () => {
  it("selects the Status and the time of the last change, escaping each id", () => {
    expect(productStatusQuery(["1", "2' or '1'='1"])).toBe(
      "select id, Status, Modified_Time from Products where id in ('1', '2\\' or \\'1\\'=\\'1') limit 2",
    );
  });
});

describe("CrmZohoStatusProducts", () => {
  it("reads each Product's Status and change time, treating blanks as none", async () => {
    const { products } = setup([
      { id: "1", Status: "Reserved", Modified_Time: "2026-11-03T12:00:00+00:00" },
      { id: "2", Status: " ", Modified_Time: null },
    ]);
    const read = await products.read(["1", "2", "3"]);
    expect(read.get("1")).toEqual({
      status: "Reserved",
      modifiedAt: new Date("2026-11-03T12:00:00Z"),
    });
    expect(read.get("2")).toEqual({ status: null, modifiedAt: null });
    expect(read.has("3")).toBe(false);
  });

  it("reads in batches of the COQL limit", async () => {
    const { products, coql } = setup();
    await products.read(Array.from({ length: ZOHO_STATUS_BATCH_SIZE + 1 }, (_, i) => String(i)));
    expect(coql.queryCoql).toHaveBeenCalledTimes(2);
  });

  it("sets only the Status on the Products module by id", async () => {
    const { products, gateway } = setup();
    await products.write("1", "Sold");
    expect(gateway.updateById).toHaveBeenCalledWith({
      module: "Products",
      recordId: "1",
      fields: { Status: "Sold" },
    });
  });

  it("throws a retryable error for a failure that may pass and a fatal one for bad data", async () => {
    const slow = setup([], { status: "error", code: "TOO_MANY_REQUESTS" });
    await expect(slow.products.write("1", "Sold")).rejects.toMatchObject({ retryable: true });
    const bad = setup([], { status: "error", code: "INVALID_DATA" });
    await expect(bad.products.write("1", "Sold")).rejects.toBeInstanceOf(CrmGatewayError);
    await expect(bad.products.write("1", "Sold")).rejects.toMatchObject({ retryable: false });
  });

  it("reads a Product deleted in Zoho as not found, without retrying", async () => {
    const gone = setup([], { status: "error", code: "RECORD_NOT_FOUND" });
    await expect(gone.products.write("1", "Sold")).rejects.toMatchObject({
      code: "product_not_found",
      retryable: false,
    });
  });
});
