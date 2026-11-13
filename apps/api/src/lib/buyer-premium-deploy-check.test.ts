import { standardBuyerPremiumBands } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  type PremiumCheckLot,
  checkPremiumLot,
  legacyBuyerPremiumSchedule,
  lockedPremiumReason,
  lotRateAfterMigration0380,
  premiumChangedAtDeploy,
  premiumCheckExitCode,
  saleWithoutBandsNotice,
} from "./buyer-premium-deploy-check.js";

const banded = { buyerPremiumRate: "0.2500", buyerPremiumTiers: standardBuyerPremiumBands() };
const flat = { buyerPremiumRate: "0.2000", buyerPremiumTiers: null };

const lot = (over: Partial<PremiumCheckLot>): PremiumCheckLot => ({
  status: "active",
  hasWinner: false,
  hasLiveInvoice: false,
  lotRate: "0.2500",
  ...over,
});
const live = lot({});
const soldNotInvoiced = lot({ status: "ended", hasWinner: true });

describe("legacyBuyerPremiumSchedule", () => {
  it("is the sale's bands whenever the sale has bands, whatever the lot holds", () => {
    expect(legacyBuyerPremiumSchedule("0.2500", banded)).toEqual({
      kind: "bands",
      bands: banded.buyerPremiumTiers,
    });
  });

  it("is the lot's own rate in a sale without bands, and outside a sale", () => {
    expect(legacyBuyerPremiumSchedule("0.2500", flat)).toEqual({ kind: "flat", rate: "0.2500" });
    expect(legacyBuyerPremiumSchedule("0.2500", null)).toEqual({ kind: "flat", rate: "0.2500" });
  });
});

describe("lockedPremiumReason", () => {
  it.each([
    [live, "live"],
    [soldNotInvoiced, "sold_not_invoiced"],
    [lot({ status: "ended", hasWinner: true, hasLiveInvoice: true }), null],
    [lot({ status: "ended" }), null],
    [lot({ status: "scheduled" }), null],
    [lot({ status: "draft" }), null],
  ] as const)("%o is %s", (input, reason) => {
    expect(lockedPremiumReason(input)).toBe(reason);
  });
});

describe("premiumChangedAtDeploy", () => {
  it("flags live and sold-not-invoiced lots whose stored 25% would win over their sale's bands", () => {
    for (const input of [live, soldNotInvoiced]) {
      expect(premiumChangedAtDeploy(input, banded, { preDeploy: false })).toBe(
        lockedPremiumReason(input),
      );
    }
  });

  it("clears them once migration 0380 is applied (or simulated before it)", () => {
    for (const input of [live, soldNotInvoiced]) {
      expect(premiumChangedAtDeploy(input, banded, { preDeploy: true })).toBeNull();
      expect(
        premiumChangedAtDeploy({ ...input, lotRate: null }, banded, { preDeploy: false }),
      ).toBe(null);
    }
  });

  it("leaves lots in a flat-rate sale alone: they keep charging their own rate", () => {
    expect(premiumChangedAtDeploy(live, flat, { preDeploy: true })).toBeNull();
    expect(premiumChangedAtDeploy(soldNotInvoiced, flat, { preDeploy: false })).toBeNull();
  });

  it("ignores invoiced lots, which every surface prices from their invoice", () => {
    const invoiced = { ...soldNotInvoiced, hasLiveInvoice: true };
    expect(premiumChangedAtDeploy(invoiced, banded, { preDeploy: false })).toBeNull();
  });

  it("does not call a lot with no legacy rate changed: the old release never priced it", () => {
    const blank = { ...live, lotRate: null };
    expect(premiumChangedAtDeploy(blank, flat, { preDeploy: false })).toBeNull();
    expect(checkPremiumLot(blank, flat, { preDeploy: false })).toMatchObject({
      changed: null,
      noLegacyRate: true,
    });
  });
});

describe("lotRateAfterMigration0380", () => {
  it("clears every lot rate in a sale with bands, invoiced or not, and keeps the rest", () => {
    expect(lotRateAfterMigration0380({ lotRate: "0.2500" }, banded)).toBeNull();
    expect(lotRateAfterMigration0380({ lotRate: "0.3000" }, banded)).toBeNull();
    expect(lotRateAfterMigration0380({ lotRate: "0.2500" }, flat)).toBe("0.2500");
    expect(lotRateAfterMigration0380({ lotRate: "0.2500" }, null)).toBe("0.2500");
  });
});

describe("checkPremiumLot", () => {
  const invoiced = lot({ status: "ended", hasWinner: true, hasLiveInvoice: true });

  it("before the migration, an invoiced lot in a sale with bands is not left holding its 25%", () => {
    expect(checkPremiumLot(invoiced, banded, { preDeploy: true })).toMatchObject({
      lotRate: null,
      bandedOverride: false,
    });
  });

  it("with --pre-deploy, compares an unopened lot's own premium after the migration (M3)", () => {
    const draft = lot({ status: "draft" });
    expect(checkPremiumLot(draft, banded, { preDeploy: false }).differsFromSale).toBe(true);
    expect(checkPremiumLot(draft, banded, { preDeploy: true })).toMatchObject({
      lotRate: null,
      differsFromSale: false,
      bandedOverride: false,
    });
  });

  it("keeps flagging an unopened lot whose own rate differs in a flat-rate sale", () => {
    const draft = lot({ status: "draft", lotRate: "0.3000" });
    expect(checkPremiumLot(draft, flat, { preDeploy: true }).differsFromSale).toBe(true);
  });
});

describe("premiumCheckExitCode", () => {
  const none = { changed: 0, differsFromSale: 0, bandedOverride: 0 };

  it("passes normal pre-migration data: banded drafts at 25% and flat-sale lots with their own rate", () => {
    const totals = { ...none };
    const rows: [PremiumCheckLot, typeof banded | typeof flat][] = [
      [lot({ status: "draft" }), banded],
      [lot({ status: "scheduled" }), banded],
      [live, banded],
      [soldNotInvoiced, banded],
      [lot({ status: "ended", hasWinner: true, hasLiveInvoice: true }), banded],
      [lot({ status: "draft", lotRate: "0.3000" }), flat],
      [live, flat],
    ];
    for (const [l, sale] of rows) {
      const check = checkPremiumLot(l, sale, { preDeploy: true });
      if (check.changed) totals.changed += 1;
      if (check.differsFromSale) totals.differsFromSale += 1;
      if (check.bandedOverride) totals.bandedOverride += 1;
    }
    expect(totals).toEqual({ changed: 0, differsFromSale: 1, bandedOverride: 0 });
    expect(premiumCheckExitCode(totals, { preDeploy: true })).toBe(0);
  });

  it("fails on a repriced locked lot or a banded override, before or after the deploy", () => {
    for (const preDeploy of [true, false]) {
      expect(premiumCheckExitCode({ ...none, changed: 1 }, { preDeploy })).toBe(1);
      expect(premiumCheckExitCode({ ...none, bandedOverride: 1 }, { preDeploy })).toBe(1);
      expect(premiumCheckExitCode(none, { preDeploy })).toBe(0);
    }
  });

  it("fails on an own premium differing from the sale's only on a run without --pre-deploy", () => {
    expect(premiumCheckExitCode({ ...none, differsFromSale: 2 }, { preDeploy: true })).toBe(0);
    expect(premiumCheckExitCode({ ...none, differsFromSale: 2 }, { preDeploy: false })).toBe(1);
  });
});

describe("saleWithoutBandsNotice", () => {
  it("names the flat rate charged on the whole hammer, and is silent for a sale with bands", () => {
    expect(saleWithoutBandsNotice(flat)).toBe("no bands: charges a flat 20% on the whole hammer");
    expect(saleWithoutBandsNotice({ ...flat, buyerPremiumRate: "0.1500" })).toBe(
      "no bands: charges a flat 15% on the whole hammer",
    );
    expect(saleWithoutBandsNotice(banded)).toBeNull();
  });
});
