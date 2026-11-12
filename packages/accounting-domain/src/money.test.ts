import { describe, expect, it } from "vitest";
import {
  type Line,
  MAX_LINE_NET_PENCE,
  VAT_TREATMENTS,
  type VatTreatment,
  buildLine,
  compareWithProviderTotals,
  lineNetPence,
  totalsOf,
  vatForLine,
} from "./money.js";
import { forAll, int, pick } from "./testing/generate.js";

const vat = (net: number, t: VatTreatment, bps?: number): number => {
  const r = vatForLine(net, t, bps);
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
};

function line(unit: number, quantity: number, treatment: VatTreatment): Line {
  const built = buildLine({
    description: "Print",
    quantity,
    unitNetPence: unit,
    treatment,
    role: "goods",
  });
  if (!built.ok) throw new Error(built.refusal.message);
  return built.value;
}

describe("vatForLine", () => {
  it("rounds half-up to the penny", () => {
    expect(vat(4, "standard", 1250)).toBe(1); // 0.5 -> 1
    expect(vat(3, "standard", 1250)).toBe(0); // 0.375 -> 0
    expect(vat(2, "standard")).toBe(0); // 0.4 -> 0
    expect(vat(3, "standard")).toBe(1); // 0.6 -> 1
    expect(vat(5, "standard")).toBe(1); // exactly 1.0
    expect(vat(12_345, "standard")).toBe(2469); // 2469.0
  });

  it("is zero for every treatment except standard", () => {
    for (const t of VAT_TREATMENTS.filter((x) => x !== "standard")) {
      expect(vat(100_000, t)).toBe(0);
    }
  });

  it("refuses fractional, negative, oversized input and bad rates with a Result, never a throw", () => {
    expect(vatForLine(1.5, "standard")).toMatchObject({
      ok: false,
      refusal: { code: "bad_amount" },
    });
    expect(vatForLine(-1, "standard")).toMatchObject({
      ok: false,
      refusal: { code: "bad_amount" },
    });
    expect(vatForLine(MAX_LINE_NET_PENCE + 1, "standard").ok).toBe(false);
    expect(vatForLine(1, "standard", 20.5)).toMatchObject({
      ok: false,
      refusal: { code: "bad_rate" },
    });
    expect(vatForLine(1, "standard", 10_001).ok).toBe(false);
  });

  it("property: ties are rounded up, with ties built on purpose", () => {
    // Build exact half pennies on purpose: net * bps === 5000 (mod 10000).
    let ties = 0;
    forAll(300, (rng) => {
      const bps = int(rng, 1, 3000);
      const start = int(rng, 0, 1_000_000);
      for (let net = start; net < start + 10_000; net++) {
        if ((net * bps) % 10_000 !== 5000) continue;
        ties++;
        expect(vat(net, "standard", bps) * 10_000).toBe(net * bps + 5000);
        break;
      }
    });
    expect(ties).toBeGreaterThan(50);
    // a fixed set of known ties
    for (const [net, bps, expected] of [
      [25, 2000, 5],
      [5, 1000, 1],
      [1, 5000, 1],
      [3, 1667, 1],
    ] as const) {
      expect(vat(net, "standard", bps)).toBe(expected);
    }
  });

  it("property: within half a penny of exact, never off by more, half-up on ties", () => {
    forAll(500, (rng) => {
      const net = int(rng, 0, 10_000_000);
      const bps = int(rng, 0, 3000);
      const v = vat(net, "standard", bps);
      const exactTimes10000 = net * bps;
      expect(Math.abs(v * 10000 - exactTimes10000)).toBeLessThanOrEqual(5000);
      if (exactTimes10000 % 10000 === 5000) expect(v * 10000).toBe(exactTimes10000 + 5000);
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
      {
        description: " ",
        quantity: 1,
        unitNetPence: 1,
        treatment: "zero" as const,
        role: "goods" as const,
      },
      "bad_description",
    ],
    [
      {
        description: "x",
        quantity: 0,
        unitNetPence: 1,
        treatment: "zero" as const,
        role: "goods" as const,
      },
      "bad_quantity",
    ],
    [
      {
        description: "x",
        quantity: 1.5,
        unitNetPence: 1,
        treatment: "zero" as const,
        role: "goods" as const,
      },
      "bad_quantity",
    ],
    [
      {
        description: "x",
        quantity: 1,
        unitNetPence: 1.5,
        treatment: "zero" as const,
        role: "goods" as const,
      },
      "bad_amount",
    ],
    [
      {
        description: "x",
        quantity: 1,
        unitNetPence: -1,
        treatment: "zero" as const,
        role: "goods" as const,
      },
      "bad_amount",
    ],
    [
      {
        description: "x",
        quantity: 1,
        unitNetPence: 1,
        treatment: "bogus" as VatTreatment,
        role: "goods" as const,
      },
      "bad_treatment",
    ],
    [
      {
        description: "x",
        quantity: Number.MAX_SAFE_INTEGER,
        unitNetPence: 2,
        treatment: "zero" as const,
        role: "goods" as const,
      },
      "bad_amount",
    ],
    [
      {
        description: "x",
        quantity: 1,
        unitNetPence: MAX_LINE_NET_PENCE + 1,
        treatment: "zero" as const,
        role: "goods" as const,
      },
      "bad_amount",
    ],
    [
      {
        description: "x",
        quantity: 1,
        unitNetPence: 1,
        treatment: "zero" as const,
        role: "gift" as "goods",
      },
      "bad_role",
    ],
  ])("refuses bad input %#", (input, code) => {
    const r = buildLine(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).toBe(code);
  });
});

describe("Line is unforgeable", () => {
  it("a hand-made object literal does not type-check as a Line", () => {
    // @ts-expect-error a Line can only come from buildLine
    const forged: Line = {
      description: "x",
      quantity: 1,
      unitNetPence: -500,
      treatment: "margin_scheme",
      role: "goods",
      vatPence: 999,
    };
    expect(forged.vatPence).toBe(999); // the literal exists, but no builder accepts it as a Line
  });
  it("margin scheme lines never carry VAT", () => {
    expect(line(100_000, 1, "margin_scheme").vatPence).toBe(0);
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
