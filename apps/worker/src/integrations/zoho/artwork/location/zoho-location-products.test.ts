import { describe, expect, it, vi } from "vitest";
import { CrmZohoLocationProducts, productLocationQuery } from "./zoho-location-products.js";

function gateway(
  rows: Record<string, unknown>[],
  updated: { status: string; code?: string }[] = [],
) {
  return {
    queryCoql: vi.fn(async () => ({ rows, moreRecords: false })),
    updateMany: vi.fn(async () => updated),
  };
}

describe("CrmZohoLocationProducts", () => {
  it("reads only id and LAX_Location, escaping ids", () => {
    expect(productLocationQuery(["1", "o'2"])).toBe(
      "select id, LAX_Location from Products where id in ('1', 'o\\'2') limit 2",
    );
  });

  it("reads what each Product shows, blank as empty, and leaves out a Product Zoho did not return", async () => {
    const products = new CrmZohoLocationProducts(
      gateway([
        { id: "1", LAX_Location: " Store room " },
        { id: "2", LAX_Location: "" },
        { id: "3", LAX_Location: null },
      ]) as never,
    );
    const shown = await products.read(["1", "2", "3", "4"]);
    expect([...shown]).toEqual([
      ["1", "Store room"],
      ["2", null],
      ["3", null],
    ]);
  });

  it("writes only the field it is given, on Products, with Zoho's answer per record", async () => {
    const fake = gateway([], [{ status: "success" }, { status: "error", code: "INVALID_DATA" }]);
    const products = new CrmZohoLocationProducts(fake as never);
    const results = await products.update([
      { productId: "1", fields: { LAX_Location: "Framer" } },
      { productId: "2", fields: { LAX_Location: null } },
    ]);
    expect(fake.updateMany).toHaveBeenCalledWith({
      module: "Products",
      records: [
        { id: "1", LAX_Location: "Framer" },
        { id: "2", LAX_Location: null },
      ],
    });
    expect(results).toEqual([
      { productId: "1", ok: true },
      { productId: "2", ok: false, code: "INVALID_DATA", retryable: false },
    ]);
  });
});
