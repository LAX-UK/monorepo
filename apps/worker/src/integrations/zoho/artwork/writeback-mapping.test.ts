import { describe, expect, it } from "vitest";
import { planStockCodeUpdate } from "./writeback-mapping.js";

describe("planStockCodeUpdate", () => {
  it("sends only the stock code, and only when it differs", () => {
    expect(planStockCodeUpdate("LAX-ORI-PH-GAC-26-0001", { stockCode: null })).toEqual({
      fields: { Reference_Stock_Code: "LAX-ORI-PH-GAC-26-0001" },
    });
    expect(
      planStockCodeUpdate("LAX-ORI-PH-GAC-26-0001", { stockCode: "LAX-ORI-PH-GAC-26-0001" }),
    ).toBeNull();
  });
});
