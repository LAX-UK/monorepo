import { describe, expect, it, vi } from "vitest";
import { CrmZohoOrderRecords, findQuery } from "./zoho-order-modules.js";

const gateway = (rows: Record<string, unknown>[] = []) => {
  const queryCoql = vi.fn().mockResolvedValue({ rows, moreRecords: false });
  const createRecord = vi.fn().mockResolvedValue({ status: "success", recordId: "new-1" });
  const updateById = vi.fn().mockResolvedValue({ status: "success", recordId: "rec-1" });
  return {
    queryCoql,
    createRecord,
    updateById,
    records: new CrmZohoOrderRecords({ queryCoql, createRecord, updateById }),
  };
};

describe("findQuery", () => {
  it("selects the id and the columns asked for, matched on the key", () => {
    expect(findQuery("Print_SKUs", "SKU", "A-1", ["SKU", "Size"])).toBe(
      "select id, SKU, Size from Print_SKUs where SKU = 'A-1' limit 1",
    );
    expect(findQuery("Dispatch_Fulfilments", "LAX_Order_Ref", "o'1", [])).toBe(
      "select id from Dispatch_Fulfilments where LAX_Order_Ref = 'o\\'1' limit 1",
    );
  });

  it("refuses a field name that is not a Zoho API name", () => {
    expect(() => findQuery("Framing_Jobs", "Ref = '' or 1", "x", [])).toThrow(
      "zoho_field_name_invalid",
    );
    expect(() => findQuery("Framing_Jobs", "Ref", "x", ["Status, Owner"])).toThrow(
      "zoho_field_name_invalid",
    );
  });
});

describe("CrmZohoOrderRecords", () => {
  it("reads a record with lookups as their id and text trimmed", async () => {
    const g = gateway([
      { id: "fj-1", Status: "Queued ", Linked_Print_SKU: { id: "sku-1", name: "x" }, N: 3 },
    ]);
    expect(
      await g.records.find("Framing_Jobs", "LAX_Order_Ref", "r", [
        "Status",
        "Linked_Print_SKU",
        "N",
      ]),
    ).toEqual({ id: "fj-1", fields: { Status: "Queued", Linked_Print_SKU: "sku-1", N: 3 } });
    expect(await gateway([]).records.find("Print_SKUs", "SKU", "s", ["SKU"])).toBeNull();
  });

  it("creates a record without an id and updates the one with an id", async () => {
    const g = gateway();
    expect(await g.records.save("Print_SKUs", null, { SKU: "s" })).toBe("new-1");
    expect(g.createRecord).toHaveBeenCalledWith({ module: "Print_SKUs", fields: { SKU: "s" } });
    expect(await g.records.save("Framing_Jobs", "rec-1", { Status: "Framed" })).toBe("rec-1");
    expect(g.updateById).toHaveBeenCalledWith({
      module: "Framing_Jobs",
      recordId: "rec-1",
      fields: { Status: "Framed" },
    });
  });

  it("keeps the id it updated when Zoho does not repeat it", async () => {
    const g = gateway();
    g.updateById.mockResolvedValueOnce({ status: "success", recordId: "" });
    expect(await g.records.save("Dispatch_Fulfilments", "df-1", { Status: "Ready" })).toBe("df-1");
  });

  it("throws when Zoho refuses the record: wrong data does not retry, anything else does", async () => {
    const g = gateway();
    g.createRecord.mockResolvedValueOnce({ status: "error", code: "INVALID_DATA", message: "m" });
    await expect(g.records.save("Print_SKUs", null, { SKU: "s" })).rejects.toMatchObject({
      code: "INVALID_DATA",
      retryable: false,
    });
    g.createRecord.mockResolvedValueOnce({ status: "success", recordId: "" });
    await expect(g.records.save("Print_SKUs", null, { SKU: "s" })).rejects.toMatchObject({
      code: "EMPTY_RESPONSE",
      retryable: true,
    });
  });
});
