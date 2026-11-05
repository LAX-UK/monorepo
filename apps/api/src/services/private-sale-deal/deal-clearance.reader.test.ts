import { describe, expect, it } from "vitest";
import { ComplianceDealClearanceReader, type DealClearanceDeps } from "./deal-clearance.reader.js";

const NOW = new Date("2026-11-03T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

type Overrides = {
  kyc?: string | null;
  hold?: "none" | "hold" | "blocked" | null;
  screening?: "pending" | "cleared" | "blocked" | "not_required" | null;
  approvedAt?: Date | null;
  pending?: boolean;
  latestRejected?: boolean;
  lotExposure?: number;
  dealExposure?: number;
};

function reader(o: Overrides = {}) {
  const deps = {
    kyc: {
      getUserKycState: async () =>
        o.kyc === null ? null : { kycStatus: (o.kyc ?? "approved") as never, kycVerifiedAt: null },
    },
    amlHolds: {
      getHold: async () => (o.hold === null ? null : { status: o.hold ?? "none", reason: null }),
    },
    screenings: {
      findLatestByUserId: async () =>
        o.screening === null ? null : ({ reviewStatus: o.screening ?? "cleared" } as never),
    },
    sourceOfFunds: {
      findLatestApprovedForUser: async () =>
        o.approvedAt ? ({ reviewedAt: o.approvedAt } as never) : null,
      findPendingForUser: async () => (o.pending ? ({} as never) : null),
      findLatestForUser: async () => (o.latestRejected ? ({ status: "rejected" } as never) : null),
      sumActiveBuyerSettlementPence: async () => o.lotExposure ?? 0,
    },
    deals: { sumOtherOpenExposureMinor: async () => o.dealExposure ?? 0 },
    sourceOfFundsValidityDays: 365,
    now: () => NOW,
  } satisfies DealClearanceDeps;
  return new ComplianceDealClearanceReader(deps);
}

const parties = {
  dealId: "d1",
  seller: { legalEntityId: "le-s", actingUserId: "u-s" },
  buyer: { legalEntityId: "le-b", actingUserId: "u-b" },
};

describe("ComplianceDealClearanceReader", () => {
  it("reports clear parties when identity and screening are clear", async () => {
    const snap = await reader().snapshot(parties);
    expect(snap.seller).toEqual({ kyc: "clear", aml: "clear" });
    expect(snap.buyer).toEqual({ kyc: "clear", aml: "clear" });
  });

  it.each([
    ["rejected", "failed"],
    ["pending", "pending"],
    ["unverified", "pending"],
  ] as const)("maps a %s identity check to %s", async (kyc, expected) => {
    expect((await reader({ kyc }).snapshot(parties)).buyer?.kyc).toBe(expected);
  });

  it("treats a party with no identity record as pending", async () => {
    expect((await reader({ kyc: null }).snapshot(parties)).seller?.kyc).toBe("pending");
  });

  it.each([
    [{ hold: "blocked" as const }, "blocked"],
    [{ hold: "hold" as const }, "review"],
    [{ screening: "pending" as const }, "review"],
    [{ screening: "blocked" as const }, "blocked"],
    [{ screening: null }, "pending"],
  ])("maps screening %j to %s", async (o, expected) => {
    expect((await reader(o).snapshot(parties)).buyer?.aml).toBe(expected);
  });

  it("leaves a party nobody acts for unclear", async () => {
    const snap = await reader().snapshot({
      ...parties,
      buyer: { legalEntityId: "le-b", actingUserId: null },
    });
    expect(snap.buyer).toEqual({ kyc: "pending", aml: "pending" });
  });

  it("has no buyer to read while none is named", async () => {
    const snap = await reader().snapshot({ ...parties, buyer: null });
    expect(snap.buyer).toBeNull();
    expect(snap.buyerSourceOfFunds).toBe("not_requested");
  });

  it("reads source of funds: approved within a year, pending, declined or not requested", async () => {
    expect((await reader({ approvedAt: daysAgo(30) }).snapshot(parties)).buyerSourceOfFunds).toBe(
      "approved",
    );
    expect((await reader({ approvedAt: daysAgo(400) }).snapshot(parties)).buyerSourceOfFunds).toBe(
      "not_requested",
    );
    expect((await reader({ pending: true }).snapshot(parties)).buyerSourceOfFunds).toBe("pending");
    expect((await reader({ latestRejected: true }).snapshot(parties)).buyerSourceOfFunds).toBe(
      "declined",
    );
    expect((await reader().snapshot(parties)).buyerSourceOfFunds).toBe("not_requested");
  });

  it("adds the buyer's open lots and other open deals into their exposure", async () => {
    const snap = await reader({ lotExposure: 300_000, dealExposure: 200_000 }).snapshot(parties);
    expect(snap.buyerOtherOpenExposureMinor).toBe(500_000);
  });
});
