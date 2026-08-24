import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { createBidEligibilityForTest } from "../container/create-bid-eligibility.js";
import { KycRequiredError } from "./interfaces/kyc-service.js";
import type { IKycService } from "./interfaces/kyc-service.js";

type WhereStep = { kind: "limit"; rows: unknown[] } | { kind: "all"; rows: unknown[] };

function createSequentialDb(steps: WhereStep[]): Database {
  const queue = [...steps];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const step = queue.shift();
          if (!step) {
            throw new Error("BidEligibilityService test: unexpected extra query");
          }
          if (step.kind === "limit") {
            return {
              limit: vi.fn(() => Promise.resolve(step.rows)),
            };
          }
          return Promise.resolve(step.rows);
        }),
      })),
    })),
  };
  return db as unknown as Database;
}

const userId = "user-1";
const buyerLeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const lotId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const saleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("BidEligibilityService.assertCanPlaceBid", () => {
  it("returns aml_blocked when buyer has hard AML block", async () => {
    const db = createSequentialDb([]);
    const amlHoldStore = {
      getHold: vi.fn().mockResolvedValue({ status: "blocked", reason: "sanctions" }),
      setHold: vi.fn(),
      clearHold: vi.fn(),
    };
    const svc = createBidEligibilityForTest(db, { amlHoldStore });
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("aml_blocked");
    }
  });

  it("allows bidding when buyer has soft AML hold", async () => {
    const db = createSequentialDb([
      {
        kind: "limit",
        rows: [
          {
            saleId: null,
            autoBidEnabled: true,
            minBidIncrement: "10",
            autoBidStepMin: null,
            autoBidStepMax: null,
            autoBidStepPresets: null,
          },
        ],
      },
      { kind: "limit", rows: [{ role: "owner" }] },
    ]);
    const amlHoldStore = {
      getHold: vi.fn().mockResolvedValue({ status: "hold", reason: "pep" }),
      setHold: vi.fn(),
      clearHold: vi.fn(),
    };
    const svc = createBidEligibilityForTest(db, { amlHoldStore });
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
    });
    expect(r.isOk()).toBe(true);
  });

  it("returns kyc_required when threshold exceeded", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId: null }] },
      { kind: "limit", rows: [{ role: "owner" }] },
    ]);
    const kycService: IKycService = {
      isConfigured: () => true,
      enforceThreshold: vi.fn().mockRejectedValue(
        new KycRequiredError({
          status: "unverified",
          verifiedAt: null,
          latestSessionId: null,
          latestSessionStatus: null,
          feedback: {
            headline: "Verification required",
            detail: null,
            action: "start",
            reasonCode: null,
            decisionStatus: null,
            needsResubmit: false,
          },
          pendingExposure: { total: 2000, currency: "GBP" },
          thresholdAmount: 1000,
          thresholdCurrency: "GBP",
          requiresKyc: true,
        }),
      ),
    } as unknown as IKycService;
    const svc = createBidEligibilityForTest(db, { kycService });
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("kyc_required");
    }
  });

  it("allows owner without sale registration when sale exists", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "owner" }] },
      { kind: "limit", rows: [] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isOk()).toBe(true);
  });

  it("allows admin role without sale registration", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "admin" }] },
      { kind: "limit", rows: [] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isOk()).toBe(true);
  });

  it("allows staff membership role without sale registration", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "staff" }] },
      { kind: "limit", rows: [] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isOk()).toBe(true);
  });

  it("returns membership_required when user is not a member", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("membership_required");
    }
  });

  it("requires sale registration for buyer_agent when none exists", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      { kind: "limit", rows: [] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("sale_registration_required");
    }
  });

  it("requires sale registration for buyer_agent when status is pending", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      { kind: "limit", rows: [{ status: "pending", bidLimit: null }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("sale_registration_required");
    }
  });

  it("requires buyer agent authorisation when registration approved", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      { kind: "limit", rows: [{ status: "approved", bidLimit: null }] },
      { kind: "all", rows: [] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("buyer_agent_authorisation_required");
    }
  });

  it("enforces registration bid limit for buyer_agent", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      { kind: "limit", rows: [{ status: "approved", bidLimit: "100.00" }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 200,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("bid_limit_exceeded");
    }
  });

  it("allows buyer_agent with approved registration and blanket authorisation", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      { kind: "limit", rows: [{ status: "approved", bidLimit: null }] },
      {
        kind: "all",
        rows: [{ saleId: null, bidLimit: null }],
      },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
    });
    expect(r.isOk()).toBe(true);
  });

  it("enforces buyer agent authorisation cap", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      { kind: "limit", rows: [{ status: "approved", bidLimit: null }] },
      {
        kind: "all",
        rows: [{ saleId, bidLimit: "50.00" }],
      },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("bid_limit_exceeded");
    }
  });

  it("enforces approved registration bid limit for owner after staff check-in", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "owner" }] },
      { kind: "limit", rows: [{ status: "approved", bidLimit: "100.00" }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 200,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("bid_limit_exceeded");
    }
  });

  it("allows owner with approved registration when under limit", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "owner" }] },
      { kind: "limit", rows: [{ status: "approved", bidLimit: "500.00" }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
    });
    expect(r.isOk()).toBe(true);
  });

  it("enforces strict actor eligibility for self-service bids", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ emailVerified: false, kycStatus: "approved" }] },
    ]);
    const enforceThreshold = vi.fn().mockRejectedValue(
      new KycRequiredError({
        status: "unverified",
        verifiedAt: null,
        latestSessionId: null,
        latestSessionStatus: null,
        feedback: {
          headline: "Verification required",
          detail: null,
          action: "start",
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: false,
        },
        pendingExposure: { total: 2000, currency: "GBP" },
        thresholdAmount: 1000,
        thresholdCurrency: "GBP",
        requiresKyc: true,
      }),
    );
    const kycService = {
      isConfigured: () => true,
      enforceThreshold,
    } as unknown as IKycService;
    const svc = createBidEligibilityForTest(db, {
      strictBidEligibilityEnabled: true,
      kycService,
    });
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
      placedVia: "absentee",
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect([r.error.status, r.error.code]).toEqual([403, "email_not_verified"]);
    }
    expect(enforceThreshold).not.toHaveBeenCalled();
  });

  it("blocks an organisation admin without approved personal KYC", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ emailVerified: true, kycStatus: "unverified" }] },
    ]);
    const svc = createBidEligibilityForTest(db, { strictBidEligibilityEnabled: true });
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect([r.error.status, r.error.code]).toEqual([402, "kyc_required"]);
    }
  });
});

describe("BidEligibilityService auto-bid", () => {
  it("rejects proxy fields when auto-bid disabled on lot", async () => {
    const db = createSequentialDb([
      {
        kind: "limit",
        rows: [
          {
            saleId: null,
            autoBidEnabled: false,
            minBidIncrement: "10.00",
            autoBidStepMin: null,
            autoBidStepMax: null,
            autoBidStepPresets: null,
          },
        ],
      },
      { kind: "limit", rows: [{ role: "owner" }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
      maxAutoBidAmount: 500,
      autoBidStepAmount: 10,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("auto_bid_disabled");
    }
  });

  it("uses max auto-bid amount against sale registration cap", async () => {
    const db = createSequentialDb([
      {
        kind: "limit",
        rows: [
          {
            saleId,
            autoBidEnabled: true,
            minBidIncrement: "10.00",
            autoBidStepMin: "10.00",
            autoBidStepMax: "50.00",
            autoBidStepPresets: [10, 20, 50],
          },
        ],
      },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      { kind: "limit", rows: [{ status: "approved", bidLimit: "200.00" }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
      maxAutoBidAmount: 500,
      autoBidStepAmount: 10,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("bid_limit_exceeded");
    }
  });

  it("rejects invalid auto-bid step against lot presets", async () => {
    const db = createSequentialDb([
      {
        kind: "limit",
        rows: [
          {
            saleId: null,
            autoBidEnabled: true,
            minBidIncrement: "10.00",
            autoBidStepMin: "10.00",
            autoBidStepMax: "50.00",
            autoBidStepPresets: [10, 20, 50],
          },
        ],
      },
      { kind: "limit", rows: [{ role: "owner" }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 100,
      maxAutoBidAmount: 500,
      autoBidStepAmount: 15,
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("auto_bid_step_invalid");
    }
  });

  it("bypasses sale registration for telephone operator with active booking", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      {
        kind: "limit",
        rows: [{ status: "confirmed", saleId, userId, buyerLegalEntityId: buyerLeId }],
      },
      { kind: "limit", rows: [{ reserveAltMax: "5000.00" }] },
    ]);
    const svc = createBidEligibilityForTest(db, { strictBidEligibilityEnabled: true });
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
      placedVia: "telephone",
      telephoneBookingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    expect(r.isOk()).toBe(true);
  });

  it("preserves threshold KYC for a positively validated telephone operator", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      {
        kind: "limit",
        rows: [{ status: "confirmed", saleId, userId, buyerLegalEntityId: buyerLeId }],
      },
      { kind: "limit", rows: [{ reserveAltMax: "5000.00" }] },
    ]);
    const kycService: IKycService = {
      isConfigured: () => true,
      enforceThreshold: vi.fn().mockRejectedValue(
        new KycRequiredError({
          status: "unverified",
          verifiedAt: null,
          latestSessionId: null,
          latestSessionStatus: null,
          feedback: {
            headline: "Verification required",
            detail: null,
            action: "start",
            reasonCode: null,
            decisionStatus: null,
            needsResubmit: false,
          },
          pendingExposure: { total: 2000, currency: "GBP" },
          thresholdAmount: 1000,
          thresholdCurrency: "GBP",
          requiresKyc: true,
        }),
      ),
    } as unknown as IKycService;
    const svc = createBidEligibilityForTest(db, {
      strictBidEligibilityEnabled: true,
      kycService,
    });

    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1000,
      placedVia: "telephone",
      telephoneBookingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });

    expect(r.isErr() && r.error.code).toBe("kyc_required");
  });

  it("enforces authorized max for telephone operator bids", async () => {
    const db = createSequentialDb([
      { kind: "limit", rows: [{ saleId }] },
      { kind: "limit", rows: [{ role: "buyer_agent" }] },
      {
        kind: "limit",
        rows: [{ status: "in_progress", saleId, userId, buyerLegalEntityId: buyerLeId }],
      },
      { kind: "limit", rows: [{ reserveAltMax: "1000.00" }] },
    ]);
    const svc = createBidEligibilityForTest(db);
    const r = await svc.assertCanPlaceBid({
      placedByUserId: userId,
      buyerLegalEntityId: buyerLeId,
      lotId,
      amount: 1500,
      placedVia: "telephone",
      telephoneBookingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.code).toBe("authorized_max_exceeded");
    }
  });
});
