import type { KycVerification } from "@auction/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../env.js";
import type { IKycRepository } from "../interfaces/kyc-repository.js";
import { KycRequiredError } from "../interfaces/kyc-service.js";
import { StripeKycService } from "./stripe-kyc.service.js";

const USER_ID = "user-1";

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    KYC_THRESHOLD_AMOUNT: 1000,
    KYC_THRESHOLD_CURRENCY: "GBP",
    STRIPE_SECRET_KEY: undefined,
    STRIPE_IDENTITY_WEBHOOK_SECRET: undefined,
    ...overrides,
  } as Env;
}

function makeRepo(opts: {
  latest?: KycVerification | null;
  exposure?: { total: number; currency: string };
}): IKycRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByStripeSessionId: vi.fn(),
    findLatestByUserId: vi.fn().mockResolvedValue(opts.latest ?? null),
    update: vi.fn(),
    getPendingExposure: vi.fn().mockResolvedValue(opts.exposure ?? { total: 0, currency: "GBP" }),
    setUserKycStatus: vi.fn(),
  };
}

function verification(
  partial: Partial<KycVerification> & { status: KycVerification["status"] },
): KycVerification {
  return {
    id: "kv1",
    userId: USER_ID,
    provider: "stripe_identity",
    stripeVerificationSessionId: "vi_1",
    decisionAt: null,
    verifiedFirstName: null,
    verifiedLastName: null,
    verifiedDateOfBirth: null,
    verifiedIdNumberLast4: null,
    verifiedIdCountry: null,
    verifiedIdType: null,
    verifiedIdExpiry: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...partial,
  };
}

describe("StripeKycService.isConfigured", () => {
  it("is false when STRIPE_SECRET_KEY is missing", () => {
    const svc = new StripeKycService(baseEnv(), makeRepo({}));
    expect(svc.isConfigured()).toBe(false);
  });

  it("is true when STRIPE_SECRET_KEY is set", () => {
    const svc = new StripeKycService(baseEnv({ STRIPE_SECRET_KEY: "sk_test_dummy" }), makeRepo({}));
    expect(svc.isConfigured()).toBe(true);
  });
});

describe("StripeKycService.getStatus", () => {
  it("returns unverified status with no exposure when no record exists", async () => {
    const svc = new StripeKycService(baseEnv(), makeRepo({}));
    const summary = await svc.getStatus(USER_ID);
    expect(summary.status).toBe("unverified");
    expect(summary.verifiedAt).toBeNull();
    expect(summary.latestSessionId).toBeNull();
    expect(summary.requiresKyc).toBe(false);
    expect(summary.thresholdAmount).toBe(1000);
    expect(summary.thresholdCurrency).toBe("GBP");
  });

  it("does NOT require KYC when exposure is below threshold", async () => {
    const svc = new StripeKycService(
      baseEnv({ KYC_THRESHOLD_AMOUNT: 1000 }),
      makeRepo({ exposure: { total: 999, currency: "GBP" } }),
    );
    const summary = await svc.getStatus(USER_ID);
    expect(summary.requiresKyc).toBe(false);
  });

  it("requires KYC when exposure is at or above threshold and status != approved", async () => {
    const svc = new StripeKycService(
      baseEnv({ KYC_THRESHOLD_AMOUNT: 1000 }),
      makeRepo({ exposure: { total: 1000, currency: "GBP" } }),
    );
    const summary = await svc.getStatus(USER_ID);
    expect(summary.status).toBe("unverified");
    expect(summary.requiresKyc).toBe(true);
  });

  it("does NOT require KYC when over threshold but already approved", async () => {
    const verifiedAt = new Date("2026-02-01T00:00:00Z");
    const svc = new StripeKycService(
      baseEnv({ KYC_THRESHOLD_AMOUNT: 500 }),
      makeRepo({
        exposure: { total: 5000, currency: "GBP" },
        latest: verification({
          id: "kv-verified",
          status: "verified",
          decisionAt: verifiedAt,
        }),
      }),
    );
    const summary = await svc.getStatus(USER_ID);
    expect(summary.status).toBe("approved");
    expect(summary.verifiedAt).toEqual(verifiedAt);
    expect(summary.requiresKyc).toBe(false);
    expect(summary.latestSessionId).toBe("vi_1");
  });

  it("maps processing → pending and requires_input → rejected", async () => {
    const svcProcessing = new StripeKycService(
      baseEnv(),
      makeRepo({ latest: verification({ status: "processing" }) }),
    );
    expect((await svcProcessing.getStatus(USER_ID)).status).toBe("pending");

    const svcRequires = new StripeKycService(
      baseEnv(),
      makeRepo({ latest: verification({ status: "requires_input" }) }),
    );
    expect((await svcRequires.getStatus(USER_ID)).status).toBe("rejected");

    const svcCanceled = new StripeKycService(
      baseEnv(),
      makeRepo({ latest: verification({ status: "canceled" }) }),
    );
    expect((await svcCanceled.getStatus(USER_ID)).status).toBe("rejected");
  });
});

describe("StripeKycService.enforceThreshold", () => {
  it("does nothing below threshold", async () => {
    const svc = new StripeKycService(
      baseEnv({ KYC_THRESHOLD_AMOUNT: 1000 }),
      makeRepo({ exposure: { total: 100, currency: "GBP" } }),
    );
    await expect(svc.enforceThreshold(USER_ID)).resolves.toBeUndefined();
  });

  it("throws KycRequiredError when over threshold and not approved", async () => {
    const svc = new StripeKycService(
      baseEnv({ KYC_THRESHOLD_AMOUNT: 1000 }),
      makeRepo({ exposure: { total: 1500, currency: "GBP" } }),
    );
    let caught: unknown;
    try {
      await svc.enforceThreshold(USER_ID);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(KycRequiredError);
    if (caught instanceof KycRequiredError) {
      expect(caught.code).toBe("kyc_required");
      expect(caught.status).toBe(402);
      expect(caught.summary.requiresKyc).toBe(true);
    }
  });

  it("does not throw when over threshold but already approved", async () => {
    const svc = new StripeKycService(
      baseEnv({ KYC_THRESHOLD_AMOUNT: 1000 }),
      makeRepo({
        exposure: { total: 5000, currency: "GBP" },
        latest: verification({ status: "verified", decisionAt: new Date() }),
      }),
    );
    await expect(svc.enforceThreshold(USER_ID)).resolves.toBeUndefined();
  });
});

describe("StripeKycService.handleWebhook (signature gate)", () => {
  let envWithStripe: Env;

  beforeEach(() => {
    envWithStripe = baseEnv({
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_IDENTITY_WEBHOOK_SECRET: "whsec_dummy",
    });
  });

  it("rejects when signature header is missing", async () => {
    const svc = new StripeKycService(envWithStripe, makeRepo({}));
    await expect(svc.handleWebhook("{}", undefined)).rejects.toThrow("missing_stripe_signature");
  });

  it("rejects with an invalid signature", async () => {
    const svc = new StripeKycService(envWithStripe, makeRepo({}));
    // Stripe will throw a signature-verification error on garbage input.
    await expect(svc.handleWebhook("{}", "t=1,v1=invalid")).rejects.toThrow();
  });
});
