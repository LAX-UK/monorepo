import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import { BidEligibilityService } from "./bid-eligibility.service.js";
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
  it("returns kyc_required when threshold exceeded", async () => {
    const db = createSequentialDb([]);
    const kycService: IKycService = {
      isConfigured: () => true,
      enforceThreshold: vi.fn().mockRejectedValue(
        new KycRequiredError({
          status: "unverified",
          verifiedAt: null,
          latestSessionId: null,
          pendingExposure: { total: 2000, currency: "GBP" },
          thresholdAmount: 1000,
          thresholdCurrency: "GBP",
          requiresKyc: true,
        }),
      ),
    } as unknown as IKycService;
    const svc = new BidEligibilityService(db, kycService);
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
    ]);
    const svc = new BidEligibilityService(db);
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
    ]);
    const svc = new BidEligibilityService(db);
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
    ]);
    const svc = new BidEligibilityService(db);
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
    const svc = new BidEligibilityService(db);
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
    const svc = new BidEligibilityService(db);
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
    const svc = new BidEligibilityService(db);
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
    const svc = new BidEligibilityService(db);
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
    const svc = new BidEligibilityService(db);
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
    const svc = new BidEligibilityService(db);
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
    const svc = new BidEligibilityService(db);
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
});
