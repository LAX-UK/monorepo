import { describe, expect, it } from "vitest";
import {
  type Line,
  VAT_TREATMENTS,
  type VatTreatment,
  buildLine,
  compareWithProviderTotals,
  lineNetPence,
  totalsOf,
  vatForLine,
} from "./money.js";
import { forAll, int, pick } from "./testing/generate.js";

function line(unit: number, quantity: number, treatment: VatTreatment): Line {
  const built = buildLine({ description: "Print", quantity, unitNetPence: unit, treatment });
  if (!built.ok) throw new Error(built.refusal.message);
  return built.value;
}

describe("vatForLine", () => {
  it("rounds half-up to the penny", () => {
    expect(vatForLine(4, "standard", 1250)).toBe(1); // 0.5 -> 1
    expect(vatForLine(3, "standard", 1250)).toBe(0); // 0.375 -> 0
    expect(vatForLine(2, "standard")).toBe(0); // 0.4 -> 0
    expect(vatForLine(3, "standard")).toBe(1); // 0.6 -> 1
    expect(vatForLine(5, "standard")).toBe(1); // exactly 1.0
    expect(vatForLine(12_345, "standard")).toBe(2469); // 2469.0
  });

  it("is zero for every treatment except standard", () => {
    for (const t of VAT_TREATMENTS.filter((x) => x !== "standard")) {
      expect(vatForLine(100_000, t)).toBe(0);
    }
  });

  it("refuses fractional or negative input", () => {
    expect(() => vatForLine(1.5, "standard")).toThrow(RangeError);
    expect(() => vatForLine(-1, "standard")).toThrow(RangeError);
    expect(() => vatForLine(1, "standard", 20.5)).toThrow(RangeError);
  });

  it("property: within half a penny of exact, never off by more, half-up on ties", () => {
    forAll(500, (rng) => {
      const net = int(rng, 0, 10_000_000);
      const bps = int(rng, 0, 3000);
      const vat = vatForLine(net, "standard", bps);
      const exactTimes10000 = net * bps;
      expect(Math.abs(vat * 10000 - exactTimes10000)).toBeLessThanOrEqual(5000);
      if (exactTimes10000 % 10000 === 5000) expect(vat * 10000).toBe(exactTimes10000 + 5000);
    });
  });
});

describe("buildLine", () => {
  it("computes VAT for the line", () => {
    const l = line(1999, 3, "standard");
    expect(lineNetPence(l)).toBe(5997);
    expect(l.vatPence).toBe(1199); // 1199.4
  });

  it.each([
    [
      { description: " ", quantity: 1, unitNetPence: 1, treatment: "zero" as const },
      "bad_description",
    ],
    [
      { description: "x", quantity: 0, unitNetPence: 1, treatment: "zero" as const },
      "bad_quantity",
    ],
    [
      { description: "x", quantity: 1.5, unitNetPence: 1, treatment: "zero" as const },
      "bad_quantity",
    ],
    [
      { description: "x", quantity: 1, unitNetPence: 1.5, treatment: "zero" as const },
      "bad_amount",
    ],
    [{ description: "x", quantity: 1, unitNetPence: -1, treatment: "zero" as const }, "bad_amount"],
    [
      { description: "x", quantity: 1, unitNetPence: 1, treatment: "bogus" as VatTreatment },
      "bad_treatment",
    ],
    [
      {
        description: "x",
        quantity: Number.MAX_SAFE_INTEGER,
        unitNetPence: 2,
        treatment: "zero" as const,
      },
      "bad_amount",
    ],
  ])("refuses bad input %#", (input, code) => {
    const r = buildLine(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).toBe(code);
  });
});

describe("totalsOf", () => {
  it("property: totals are exactly the sum of the lines, with no extra rounding", () => {
    forAll(300, (rng) => {
      const lines = Array.from({ length: int(rng, 1, 12) }, () =>
        line(int(rng, 0, 500_000), int(rng, 1, 5), pick(rng, VAT_TREATMENTS)),
      );
      const totals = totalsOf(lines);
      expect(totals.netPence).toBe(lines.reduce((n, l) => n + l.quantity * l.unitNetPence, 0));
      expect(totals.vatPence).toBe(lines.reduce((n, l) => n + l.vatPence, 0));
      expect(totals.grossPence).toBe(totals.netPence + totals.vatPence);
    });
  });

  it("sums per-line VAT, so it can differ from VAT on the net total", () => {
    const lines = [line(2, 1, "standard"), line(2, 1, "standard")]; // 0.4p each -> 0
    expect(totalsOf(lines).vatPence).toBe(0);
  });
});

describe("compareWithProviderTotals", () => {
  const ours = totalsOf([line(1000, 1, "standard")]);
  it("matches only when every field is identical", () => {
    expect(compareWithProviderTotals(ours, { ...ours })).toEqual({ matches: true });
  });
  it("reports a one-penny difference rather than adjusting", () => {
    expect(compareWithProviderTotals(ours, { ...ours, vatPence: ours.vatPence + 1 })).toEqual({
      matches: false,
      field: "vatPence",
      differencePence: 1,
    });
    expect(compareWithProviderTotals(ours, { ...ours, netPence: ours.netPence - 1 })).toMatchObject(
      {
        matches: false,
        field: "netPence",
        differencePence: -1,
      },
    );
    expect(
      compareWithProviderTotals(ours, { ...ours, grossPence: ours.grossPence + 5 }),
    ).toMatchObject({
      matches: false,
      field: "grossPence",
    });
  });
});
