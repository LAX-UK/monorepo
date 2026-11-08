import { describe, expect, it, vi } from "vitest";
import { CrmZohoPrintModules, ledgerQuery, printProductQuery } from "./zoho-print-modules.js";

const gateway = (rows: Record<string, unknown>[][] = [[], []]) => {
  const queryCoql = vi.fn();
  for (const page of rows) queryCoql.mockResolvedValueOnce({ rows: page, moreRecords: false });
  const upsert = vi.fn().mockResolvedValue({ status: "success", recordId: "rec-1" });
  return { queryCoql, upsert, modules: new CrmZohoPrintModules({ queryCoql, upsert }) };
};

describe("CrmZohoPrintModules", () => {
  it("looks the group up by its group id and its ledger by the mirror key", async () => {
    const g = gateway();
    await g.modules.readGroup("LAX-PRT-MP-GAC-26-0037");
    expect(g.queryCoql.mock.calls[0]?.[0]).toBe(printProductQuery("LAX-PRT-MP-GAC-26-0037"));
    expect(g.queryCoql.mock.calls[1]?.[0]).toBe(ledgerQuery("group:LAX-PRT-MP-GAC-26-0037"));
    expect(printProductQuery("a'b")).toContain("a\\'b");
  });

  it("reads what Zoho holds, whether a lookup arrives as an object or an id", async () => {
    const g = gateway([
      [
        {
          id: "pp-1",
          Print_Group_ID: "C",
          Total_Edition_Quantity: 24,
          Collector_Allocation: "10",
          Edition_Type: "Numbered",
          Linked_Original_Artwork: { id: "zp-orig", name: "x" },
        },
      ],
      [{ id: "led-1", LAX_Mirror_Key: "group:C", Linked_Print_Product_Group: "pp-1" }],
    ]);
    const state = await g.modules.readGroup("C");
    expect(state.printProduct).toEqual({
      id: "pp-1",
      fields: {
        Print_Group_ID: "C",
        Total_Edition_Quantity: 24,
        Collector_Allocation: 10,
        Edition_Type: "Numbered",
        Linked_Original_Artwork: "zp-orig",
      },
    });
    expect(state.ledger?.fields.Linked_Print_Product_Group).toBe("pp-1");
  });

  it("upserts on the group id and the mirror key, with lookups and without empty fields", async () => {
    const g = gateway();
    await g.modules.upsertPrintProduct({
      Print_Group_ID: "C",
      Total_Edition_Quantity: 24,
      Collector_Allocation: 10,
      Artist_Allocation: 10,
      LAX_Allocation: 4,
      Edition_Type: null,
      Linked_Original_Artwork: "zp-orig",
    });
    await g.modules.upsertLedger({
      LAX_Mirror_Key: "group:C",
      Linked_Print_Product_Group: "pp-1",
      Total_Edition: 24,
    });
    expect(g.upsert.mock.calls[0]?.[0]).toMatchObject({
      module: "Print_Products",
      duplicateCheckFields: ["Print_Group_ID"],
      fields: { Linked_Original_Artwork: { id: "zp-orig" } },
    });
    expect(g.upsert.mock.calls[0]?.[0].fields).not.toHaveProperty("Edition_Type");
    expect(g.upsert.mock.calls[1]?.[0]).toMatchObject({
      module: "Edition_Ledgers",
      duplicateCheckFields: ["LAX_Mirror_Key"],
      fields: { Linked_Print_Product_Group: { id: "pp-1" } },
    });
  });

  it("fails without a retry when Zoho refuses the data, and retries anything else", async () => {
    const g = gateway();
    g.upsert.mockResolvedValueOnce({ status: "error", code: "INVALID_DATA", recordId: "" });
    g.upsert.mockResolvedValueOnce({ status: "error", code: "INTERNAL_ERROR", recordId: "" });
    const fields = { LAX_Mirror_Key: "k", Linked_Print_Product_Group: "p", Total_Edition: 1 };
    await expect(g.modules.upsertLedger(fields)).rejects.toMatchObject({ retryable: false });
    await expect(g.modules.upsertLedger(fields)).rejects.toMatchObject({ retryable: true });
  });
});
