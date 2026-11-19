import { describe, expect, it } from "vitest";
import { planStockCodeUpdate } from "./writeback-mapping.js";

const CODE = "LAX-ORI-PH-GAC-26-0001";
const zoho = (stockCode: string | null) => ({ stockCode, modifiedAt: null });

describe("planStockCodeUpdate", () => {
  it("sends only the stock code, and only where Zoho holds none", () => {
    expect(planStockCodeUpdate(CODE, zoho(null))).toEqual({
      kind: "write",
      update: { fields: { Reference_Stock_Code: CODE } },
    });
  });

  it("sends nothing when Zoho already holds the code LAX wrote", () => {
    expect(planStockCodeUpdate(CODE, zoho(CODE))).toEqual({ kind: "in_sync" });
  });

  it("never overwrites a stock code edited in Zoho: it is a conflict for staff", () => {
    expect(planStockCodeUpdate(CODE, zoho("LAX-ORI-PH-GAC-26-0099"))).toEqual({
      kind: "conflict",
      zohoStockCode: "LAX-ORI-PH-GAC-26-0099",
    });
  });
});
