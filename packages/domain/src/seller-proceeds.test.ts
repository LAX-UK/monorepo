import { describe, expect, it } from "vitest";
import {
  type CommissionVatTreatment,
  type SellerProceeds,
  commissionPercentToBps,
  sellerProceeds,
} from "./seller-proceeds.js";

const pounds = (amount: number) => Math.round(amount * 100);

function agreementProceeds(
  hammerPence: number,
  commissionBps: number,
  vat: CommissionVatTreatment | null = "standard",
) {
  return sellerProceeds({ hammerPence, party: { kind: "agreement", commissionBps }, vat });
}

function paid(result: SellerProceeds) {
  if (result.basis !== "agreement") throw new Error(`expected a payable sale, got ${result.basis}`);
  return result;
}

describe("sellerProceeds: the worked fixtures", () => {
  it("the owner's example: £82,000 at 15% plus VAT", () => {
    const got = paid(agreementProceeds(pounds(82_000), 1500));
    expect(got).toMatchObject({
      commissionPence: pounds(12_300),
      vatPence: pounds(2_460),
      netPence: pounds(67_240),
      vatBps: 2000,
      vatTreatment: "standard",
      otherCharges: [],
    });
  });

  it("a half-penny commission rounds up: £333.00 at 12.5%", () => {
    const got = paid(agreementProceeds(pounds(333), 1250));
    // 4,162.5p rounds to 4,163p; VAT is 832.6p, 833p.
    expect(got.commissionPence).toBe(4163);
    expect(got.vatPence).toBe(833);
    expect(got.netPence).toBe(28_304);
  });

  it("a seller below 5%: £10,000.00 at 3%", () => {
    const got = paid(agreementProceeds(pounds(10_000), 300));
    expect(got).toMatchObject({
      commissionPence: pounds(300),
      vatPence: pounds(60),
      netPence: pounds(9_640),
    });
  });

  it("LAX-owned stock has no commission, no VAT and no payout", () => {
    expect(
      sellerProceeds({ hammerPence: pounds(4_800), party: { kind: "lax_owned" }, vat: "standard" }),
    ).toEqual({ basis: "lax_owned", hammerPence: pounds(4_800), netPence: 0 });
  });

  it("a company that is not VAT-registered charges no VAT, and says so", () => {
    const got = paid(agreementProceeds(pounds(6_200), 1500, "not_registered"));
    expect(got).toMatchObject({
      commissionPence: pounds(930),
      vatPence: 0,
      vatBps: 0,
      vatTreatment: "not_registered",
      netPence: pounds(5_270),
    });
  });

  it("a zero commission agreement is valid", () => {
    const got = paid(agreementProceeds(pounds(1_500), 0));
    expect(got).toMatchObject({ commissionPence: 0, vatPence: 0, netPence: pounds(1_500) });
  });
});

describe("sellerProceeds: held and refused", () => {
  it("holds a sale when the VAT setting is missing, rather than guessing", () => {
    expect(agreementProceeds(pounds(1_000), 1500, null)).toEqual({
      basis: "held",
      reason: "vat_setting_missing",
      hammerPence: pounds(1_000),
    });
  });

  it("LAX-owned stock needs no VAT setting", () => {
    expect(
      sellerProceeds({ hammerPence: 100, party: { kind: "lax_owned" }, vat: null }).basis,
    ).toBe("lax_owned");
  });

  it("holds a sale whose deductions are more than the hammer", () => {
    // 100% commission plus 20% VAT on it is 120% of the hammer.
    expect(agreementProceeds(pounds(100), 10_000)).toMatchObject({
      basis: "held",
      reason: "negative_net",
    });
    // 83.33% is the highest rate that still leaves something to pay.
    expect(agreementProceeds(pounds(100), 8333).basis).toBe("agreement");
    expect(agreementProceeds(pounds(100), 8334).basis).toBe("held");
  });

  it.each([
    ["a fractional hammer", { hammerPence: 10.5, bps: 1500 }],
    ["a negative hammer", { hammerPence: -1, bps: 1500 }],
    ["a hammer over £1bn", { hammerPence: 100_000_000_001, bps: 1500 }],
    ["a rate above 100%", { hammerPence: 100, bps: 10_001 }],
    ["a negative rate", { hammerPence: 100, bps: -1 }],
    ["a fractional rate", { hammerPence: 100, bps: 12.5 }],
  ])("refuses %s", (_name, { hammerPence, bps }) => {
    expect(() => agreementProceeds(hammerPence, bps)).toThrow(RangeError);
  });
});

describe("commissionPercentToBps", () => {
  it.each([
    ["15.00", 1500],
    ["12.50", 1250],
    ["12.5", 1250],
    ["0.00", 0],
    ["0.05", 5],
    ["100.00", 10_000],
    ["7", 700],
  ])("reads %s exactly as %s basis points", (percent, bps) => {
    expect(commissionPercentToBps(percent)).toBe(bps);
  });

  it.each([null, "", "abc", "-1.00", "100.01", "999.99", "1.234", "1e2"])(
    "does not read %s as a rate",
    (percent) => {
      expect(commissionPercentToBps(percent)).toBeNull();
    },
  );
});

/** A small seeded generator, so a failure reproduces from its seed. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function* cases(count: number, seed: number) {
  const next = seeded(seed);
  for (let i = 0; i < count; i++) {
    // Mix small, mid and very large hammers so every magnitude is covered.
    const magnitude = [1_000, 1_000_000, 100_000_000_000][Math.floor(next() * 3)] ?? 1_000;
    yield {
      hammer: Math.floor(next() * (magnitude + 1)),
      bps: Math.floor(next() * 10_001),
      vat: (next() < 0.5 ? "standard" : "not_registered") as CommissionVatTreatment,
    };
  }
}

describe("sellerProceeds: invariants over many cases", () => {
  const sample = [...cases(20_000, 20261112)];

  it("commission + VAT + net equals the hammer, exactly", () => {
    for (const { hammer, bps, vat } of sample) {
      const got = agreementProceeds(hammer, bps, vat);
      if (got.basis !== "agreement") continue;
      expect(
        got.commissionPence + got.vatPence + got.netPence,
        JSON.stringify({ hammer, bps }),
      ).toBe(hammer);
    }
  });

  it("commission is within half a penny of the exact value", () => {
    for (const { hammer, bps } of sample) {
      const got = agreementProceeds(hammer, bps);
      if (got.basis !== "agreement") continue;
      // |commission - hammer*bps/10000| <= 0.5  <=>  |10000*commission - hammer*bps| <= 5000
      expect(Math.abs(10_000 * got.commissionPence - hammer * bps)).toBeLessThanOrEqual(5_000);
    }
  });

  it("VAT is within half a penny of 20% of the commission", () => {
    for (const { hammer, bps } of sample) {
      const got = agreementProceeds(hammer, bps, "standard");
      if (got.basis !== "agreement") continue;
      expect(Math.abs(10_000 * got.vatPence - got.commissionPence * 2000)).toBeLessThanOrEqual(
        5_000,
      );
    }
  });

  it("is never negative: a sale that would be is held", () => {
    for (const { hammer, bps, vat } of sample) {
      const got = agreementProceeds(hammer, bps, vat);
      if (got.basis === "agreement") expect(got.netPence).toBeGreaterThanOrEqual(0);
      else expect(got).toMatchObject({ basis: "held", reason: "negative_net" });
    }
  });

  it("charges no VAT when the company is not registered", () => {
    for (const { hammer, bps } of sample) {
      const got = agreementProceeds(hammer, bps, "not_registered");
      if (got.basis === "agreement") expect(got.vatPence).toBe(0);
    }
  });

  it("commission and what the seller receives move the right way as the hammer rises", () => {
    const next = seeded(7);
    for (let i = 0; i < 5_000; i++) {
      const bps = Math.floor(next() * 8_333);
      const low = Math.floor(next() * 10_000_000);
      const high = low + Math.floor(next() * 10_000_000);
      const a = paid(agreementProceeds(low, bps));
      const b = paid(agreementProceeds(high, bps));
      expect(b.commissionPence).toBeGreaterThanOrEqual(a.commissionPence);
      expect(b.vatPence).toBeGreaterThanOrEqual(a.vatPence);
      // A higher hammer never leaves the seller with less.
      expect(b.netPence).toBeGreaterThanOrEqual(a.netPence);
    }
  });

  it("totals over many lots equal the sum of the lots, with no re-rounding", () => {
    const lots = sample.slice(0, 500).map(({ hammer, bps }) => agreementProceeds(hammer, bps));
    const payable = lots.filter((l) => l.basis === "agreement").map(paid);
    const sum = (pick: (l: (typeof payable)[number]) => number) =>
      payable.reduce((t, l) => t + pick(l), 0);
    expect(sum((l) => l.commissionPence) + sum((l) => l.vatPence) + sum((l) => l.netPence)).toBe(
      sum((l) => l.hammerPence),
    );
  });
});
