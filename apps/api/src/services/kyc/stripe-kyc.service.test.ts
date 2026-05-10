import type { KycVerification, UserKycStatus } from "@auction/types";
import type Stripe from "stripe";
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
  userKycState?: { kycStatus: UserKycStatus; kycVerifiedAt: Date | null } | null;
  findByStripeSessionId?: KycVerification | null;
  updateResult?: KycVerification;
  getUserKycWebhookState?: { currentKycSessionId: string | null; kycRetryCount: number } | null;
}): IKycRepository {
  const updateResult =
    opts.updateResult ??
    verification({
      id: "kv-updated",
      status: "verified",
      stripeVerificationSessionId: "vi_1",
    });
  return {
    create: vi.fn(),
    createWithCurrentStripeSession: vi.fn().mockImplementation(async (input) =>
      verification({
        id: "kv1",
        status: "created",
        stripeVerificationSessionId: input.stripeVerificationSessionId,
      }),
    ),
    findById: vi.fn(),
    findByStripeSessionId: vi.fn().mockResolvedValue(opts.findByStripeSessionId ?? null),
    findLatestByUserId: vi.fn().mockResolvedValue(opts.latest ?? null),
    update: vi.fn().mockResolvedValue(updateResult),
    getPendingExposure: vi.fn().mockResolvedValue(opts.exposure ?? { total: 0, currency: "GBP" }),
    setUserKycStatus: vi.fn(),
    getUserKycWebhookState: vi
      .fn()
      .mockResolvedValue(
        opts.getUserKycWebhookState ?? { currentKycSessionId: "vi_1", kycRetryCount: 0 },
      ),
    incrementUserKycRetryCount: vi.fn(),
    getUserKycState: vi
      .fn()
      .mockResolvedValue(opts.userKycState ?? { kycStatus: "unverified", kycVerifiedAt: null }),
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

function injectStripeWebhookConstruct(svc: StripeKycService, event: Stripe.Event) {
  (
    svc as unknown as {
      stripe: Pick<Stripe, "webhooks">;
    }
  ).stripe = {
    webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
  } as unknown as Stripe;
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
  it("returns unverified status with no exposure when user state is unverified", async () => {
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
      makeRepo({
        exposure: { total: 1000, currency: "GBP" },
        userKycState: { kycStatus: "unverified", kycVerifiedAt: null },
      }),
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
        userKycState: { kycStatus: "approved", kycVerifiedAt: verifiedAt },
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

  it("uses user.kyc_status from DB, not latest verification row alone", async () => {
    const svc = new StripeKycService(
      baseEnv(),
      makeRepo({
        latest: verification({ status: "requires_input" }),
        userKycState: { kycStatus: "pending", kycVerifiedAt: null },
        exposure: { total: 0, currency: "GBP" },
      }),
    );
    const summary = await svc.getStatus(USER_ID);
    expect(summary.status).toBe("pending");
  });
});

describe("StripeKycService.createSession", () => {
  it("uses createWithCurrentStripeSession (current Stripe session + pending user)", async () => {
    const repo = makeRepo({});
    const env = baseEnv({ STRIPE_SECRET_KEY: "sk_test_dummy" });
    const svc = new StripeKycService(env, repo);
    (
      svc as unknown as {
        stripe: Pick<Stripe, "identity">;
      }
    ).stripe = {
      identity: {
        verificationSessions: {
          create: vi.fn().mockResolvedValue({
            id: "vi_new",
            status: "requires_input",
            client_secret: "cs",
            url: "https://stripe.test/hosted",
          }),
        },
      },
    } as unknown as Stripe;

    const result = await svc.createSession(USER_ID, "https://return.test");

    expect(repo.createWithCurrentStripeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        stripeVerificationSessionId: "vi_new",
      }),
    );
    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
    expect(result.sessionId).toBe("vi_new");
  });
});

describe("StripeKycService.handleWebhook", () => {
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
    await expect(svc.handleWebhook("{}", "t=1,v1=invalid")).rejects.toThrow();
  });

  it("requires_input without last_error does not update user kyc_status", async () => {
    const existing = verification({
      id: "kv1",
      status: "requires_input",
      stripeVerificationSessionId: "vi_1",
    });
    const repo = makeRepo({
      findByStripeSessionId: existing,
      updateResult: { ...existing, status: "requires_input" },
      getUserKycWebhookState: { currentKycSessionId: "vi_1", kycRetryCount: 0 },
    });
    const svc = new StripeKycService(envWithStripe, repo);
    injectStripeWebhookConstruct(svc, {
      type: "identity.verification_session.updated",
      data: {
        object: {
          id: "vi_1",
          status: "requires_input",
          last_error: null,
        },
      },
    } as unknown as Stripe.Event);

    const result = await svc.handleWebhook("{}", "sig");

    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
    expect(repo.incrementUserKycRetryCount).not.toHaveBeenCalled();
    expect(result.shouldProgressIndividuals).toBe(false);
  });

  it("hard last_error increments retry and sets rejected", async () => {
    const existing = verification({
      id: "kv1",
      status: "requires_input",
      stripeVerificationSessionId: "vi_1",
    });
    const repo = makeRepo({
      findByStripeSessionId: existing,
      updateResult: { ...existing, status: "requires_input" },
      getUserKycWebhookState: { currentKycSessionId: "vi_1", kycRetryCount: 0 },
    });
    const svc = new StripeKycService(envWithStripe, repo);
    injectStripeWebhookConstruct(svc, {
      type: "identity.verification_session.updated",
      data: {
        object: {
          id: "vi_1",
          status: "requires_input",
          last_error: { code: "document_expired" },
        },
      },
    } as unknown as Stripe.Event);

    await svc.handleWebhook("{}", "sig");

    expect(repo.setUserKycStatus).toHaveBeenCalledWith(USER_ID, "rejected", null);
    expect(repo.incrementUserKycRetryCount).toHaveBeenCalledWith(USER_ID);
  });

  it("consent_declined maps to rejected without retry increment", async () => {
    const existing = verification({
      id: "kv1",
      status: "requires_input",
      stripeVerificationSessionId: "vi_1",
    });
    const repo = makeRepo({
      findByStripeSessionId: existing,
      updateResult: { ...existing, status: "requires_input" },
      getUserKycWebhookState: { currentKycSessionId: "vi_1", kycRetryCount: 0 },
    });
    const svc = new StripeKycService(envWithStripe, repo);
    injectStripeWebhookConstruct(svc, {
      type: "identity.verification_session.updated",
      data: {
        object: {
          id: "vi_1",
          status: "requires_input",
          last_error: { code: "consent_declined" },
        },
      },
    } as unknown as Stripe.Event);

    await svc.handleWebhook("{}", "sig");

    expect(repo.setUserKycStatus).toHaveBeenCalledWith(USER_ID, "rejected", null);
    expect(repo.incrementUserKycRetryCount).not.toHaveBeenCalled();
  });

  it("verified sets approved and enables individual progression flag", async () => {
    const existing = verification({
      id: "kv1",
      status: "processing",
      stripeVerificationSessionId: "vi_1",
    });
    const updated = { ...existing, status: "verified" as const };
    const repo = makeRepo({
      findByStripeSessionId: existing,
      updateResult: updated,
      getUserKycWebhookState: { currentKycSessionId: "vi_1", kycRetryCount: 0 },
    });
    const svc = new StripeKycService(envWithStripe, repo);
    injectStripeWebhookConstruct(svc, {
      type: "identity.verification_session.updated",
      data: {
        object: {
          id: "vi_1",
          status: "verified",
          last_error: null,
          verified_outputs: null,
        },
      },
    } as unknown as Stripe.Event);

    const result = await svc.handleWebhook("{}", "sig");

    expect(repo.setUserKycStatus).toHaveBeenCalledWith(USER_ID, "approved", expect.any(Date));
    expect(result.shouldProgressIndividuals).toBe(true);
  });

  it("canceled is a no-op on user columns", async () => {
    const existing = verification({
      id: "kv1",
      status: "processing",
      stripeVerificationSessionId: "vi_1",
    });
    const repo = makeRepo({
      findByStripeSessionId: existing,
      updateResult: { ...existing, status: "canceled" },
      getUserKycWebhookState: { currentKycSessionId: "vi_1", kycRetryCount: 0 },
    });
    const svc = new StripeKycService(envWithStripe, repo);
    injectStripeWebhookConstruct(svc, {
      type: "identity.verification_session.updated",
      data: {
        object: {
          id: "vi_1",
          status: "canceled",
          last_error: null,
        },
      },
    } as unknown as Stripe.Event);

    await svc.handleWebhook("{}", "sig");

    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
  });

  it("ignores user state when webhook session is not current", async () => {
    const existing = verification({
      id: "kv-old",
      status: "verified",
      stripeVerificationSessionId: "vi_old",
    });
    const repo = makeRepo({
      findByStripeSessionId: existing,
      updateResult: { ...existing, status: "verified" },
      getUserKycWebhookState: { currentKycSessionId: "vi_new", kycRetryCount: 0 },
    });
    const svc = new StripeKycService(envWithStripe, repo);
    injectStripeWebhookConstruct(svc, {
      type: "identity.verification_session.updated",
      data: {
        object: {
          id: "vi_old",
          status: "verified",
          last_error: null,
          verified_outputs: null,
        },
      },
    } as unknown as Stripe.Event);

    const result = await svc.handleWebhook("{}", "sig");

    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
    expect(repo.incrementUserKycRetryCount).not.toHaveBeenCalled();
    expect(result.shouldProgressIndividuals).toBe(false);
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
      makeRepo({
        exposure: { total: 1500, currency: "GBP" },
        userKycState: { kycStatus: "unverified", kycVerifiedAt: null },
      }),
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
        userKycState: { kycStatus: "approved", kycVerifiedAt: new Date() },
        latest: verification({ status: "verified", decisionAt: new Date() }),
      }),
    );
    await expect(svc.enforceThreshold(USER_ID)).resolves.toBeUndefined();
  });
});
