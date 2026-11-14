import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_SALE_CURRENCY, seedLotEstimate } from "./seed-lot-estimate.js";

describe("seed lot estimates", () => {
  it("are in the sale's currency (pounds sterling)", () => {
    expect(seedLotEstimate("45000.00", "65000.00")).toEqual({
      low: "45000.00",
      high: "65000.00",
      currency: "GBP",
    });
    expect(SEED_SALE_CURRENCY).toBe("GBP");
  });

  it("the demo seed never writes an estimate with its own currency", () => {
    const src = readFileSync(new URL("./legacy-demo-seed.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/estimate:\s*\{[^}]*currency/);
  });
});
