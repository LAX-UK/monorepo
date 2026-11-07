import { describe, expect, it } from "vitest";
import { payHref } from "./pay-links";
import { PAY_MAX_LOTS, parsePayLots } from "./pay-lots";
import { LOT_A, LOT_B } from "./pay-plan-fixtures.test-util";

describe("parsePayLots", () => {
  it("reads lot ids once each, in the order given", () => {
    expect(parsePayLots(`${LOT_B},${LOT_A},${LOT_B}`)).toEqual({
      kind: "lots",
      ids: [LOT_B, LOT_A],
    });
  });

  it("ignores spaces and capitals, and drops anything that is not a lot id", () => {
    expect(parsePayLots(` ${LOT_A.toUpperCase()} , nonsense ,, `)).toEqual({
      kind: "lots",
      ids: [LOT_A],
    });
  });

  it("tells a missing list from one that holds nothing usable", () => {
    expect(parsePayLots(undefined)).toEqual({ kind: "none" });
    expect(parsePayLots("  ")).toEqual({ kind: "none" });
    expect(parsePayLots("nonsense,12")).toEqual({ kind: "invalid" });
  });

  it("accepts a repeated parameter as one list", () => {
    expect(parsePayLots([LOT_A, LOT_B])).toEqual({ kind: "lots", ids: [LOT_A, LOT_B] });
  });

  it("refuses more lots than one payment covers", () => {
    const ids = Array.from(
      { length: PAY_MAX_LOTS + 1 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(parsePayLots(ids.join(","))).toEqual({ kind: "too_many" });
    expect(parsePayLots(ids.slice(0, PAY_MAX_LOTS).join(","))).toMatchObject({ kind: "lots" });
  });
});

describe("payHref", () => {
  it("builds the Pay page address for the lots", () => {
    expect(payHref([LOT_A, LOT_B])).toBe(`/purchases/pay?lots=${LOT_A},${LOT_B}`);
    expect(payHref([])).toBe("/purchases/pay");
  });

  it("round-trips through the parser", () => {
    const query = payHref([LOT_A, LOT_B]).split("lots=")[1];
    expect(parsePayLots(query)).toEqual({ kind: "lots", ids: [LOT_A, LOT_B] });
  });
});
