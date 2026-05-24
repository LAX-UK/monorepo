import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../env.js";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import type { IKycRepository } from "../interfaces/kyc-repository.js";
import { KycAlreadyApprovedError, VeriffWebhookPayloadError } from "../interfaces/kyc-service.js";
import { KycDecisionProcessor } from "./kyc-decision-processor.js";
import { VeriffKycService } from "./veriff-kyc.service.js";
import { mapVeriffDecisionToApplyInput } from "./veriff-status-mapper.js";

vi.mock("../../lib/processed-webhook-event.js", () => ({
  tryClaimProcessedWebhookEvent: vi.fn(),
}));

const API_KEY = "test-api-key";

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    VERIFF_API_KEY: undefined,
    VERIFF_SHARED_SECRET: undefined,
    VERIFF_API_BASE_URL: "https://stationapi.veriff.com",
    KYC_THRESHOLD_AMOUNT: 1000,
    KYC_THRESHOLD_CURRENCY: "GBP",
    ...overrides,
  } as Env;
}

function makeRepo(overrides: Partial<IKycRepository> = {}): IKycRepository {
  return {
    create: vi.fn(),
    createWithCurrentSession: vi.fn(),
    findById: vi.fn(),
    findByProviderSessionId: vi.fn(),
    findLatestByUserId: vi.fn(),
    update: vi.fn(),
    getPendingExposure: vi.fn().mockResolvedValue({ total: 0, currency: "GBP" }),
    setUserKycStatus: vi.fn(),
    getUserKycWebhookState: vi.fn(),
    incrementUserKycRetryCount: vi.fn(),
    getUserKycState: vi.fn(),
    ...overrides,
  };
}

const sampleVerification = {
  id: "session-1",
  userId: "user-1",
  provider: "veriff",
  providerSessionId: "session-1",
  providerAttemptId: null,
  status: "created" as const,
  verifiedFirstName: null,
  verifiedLastName: null,
  verifiedDateOfBirth: null,
  verifiedIdNumberLast4: null,
  verifiedIdCountry: null,
  verifiedIdType: null,
  verifiedIdExpiry: null,
  createdAt: new Date(),
  decisionAt: null,
};

describe("VeriffKycService.isConfigured", () => {
  it("returns false without VERIFF_API_KEY", () => {
    const svc = new VeriffKycService(baseEnv(), makeRepo({}));
    expect(svc.isConfigured()).toBe(false);
  });

  it("returns false with API key but no shared secret", () => {
    const svc = new VeriffKycService(baseEnv({ VERIFF_API_KEY: API_KEY }), makeRepo({}));
    expect(svc.isConfigured()).toBe(false);
  });

  it("returns true when both VERIFF_API_KEY and VERIFF_SHARED_SECRET are set", () => {
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: "secret" }),
      makeRepo({}),
    );
    expect(svc.isConfigured()).toBe(true);
  });
});

describe("mapVeriffDecisionToApplyInput", () => {
  it("maps approved decision", () => {
    const input = mapVeriffDecisionToApplyInput(
      {
        id: "session-1",
        status: "approved",
        person: { firstName: "Jane", lastName: "Doe", dateOfBirth: "1990-01-01" },
        document: { country: "GB", type: "PASSPORT", number: "AB123456" },
        decisionTime: "2024-01-01T00:00:00Z",
      },
      {},
    );
    expect(input.verificationStatus).toBe("verified");
    expect(input.userKycUpdate.setStatus).toBe("approved");
    expect(input.isApproved).toBe(true);
    expect(input.verifiedFields.verifiedFirstName).toBe("Jane");
    expect(input.verifiedFields.verifiedIdNumberLast4).toBe("3456");
  });

  it("maps resubmission_requested without retry increment", () => {
    const input = mapVeriffDecisionToApplyInput(
      { id: "session-1", status: "resubmission_requested", reasonCode: 201 },
      {},
    );
    expect(input.verificationStatus).toBe("requires_input");
    expect(input.userKycUpdate.incrementRetry).toBe(false);
  });

  it("maps declined fraud with retry increment", () => {
    const input = mapVeriffDecisionToApplyInput(
      { id: "session-1", status: "declined", reasonCode: 105 },
      {},
    );
    expect(input.userKycUpdate.setStatus).toBe("rejected");
    expect(input.userKycUpdate.incrementRetry).toBe(true);
  });
});

describe("VeriffKycService.handleDecisionWebhook", () => {
  const secret = "test-shared-secret";

  function sign(body: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("rejects invalid signature", async () => {
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: secret }),
      makeRepo({}),
    );
    await expect(svc.handleDecisionWebhook("{}", "bad", API_KEY)).rejects.toThrow();
  });

  it("rejects missing x-auth-client", async () => {
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: secret }),
      makeRepo({}),
    );
    const body = JSON.stringify({
      status: "success",
      verification: { id: "s1", status: "approved" },
    });
    await expect(svc.handleDecisionWebhook(body, sign(body), undefined)).rejects.toThrow();
  });

  it("updates user on approved decision for current session", async () => {
    const repo = makeRepo({
      findByProviderSessionId: vi.fn().mockResolvedValue(sampleVerification),
      getUserKycWebhookState: vi.fn().mockResolvedValue({
        currentKycSessionId: "session-1",
        kycRetryCount: 0,
      }),
      getUserKycState: vi.fn().mockResolvedValue({ kycStatus: "unverified", kycVerifiedAt: null }),
      update: vi.fn().mockResolvedValue({ ...sampleVerification, status: "verified" }),
      setUserKycStatus: vi.fn(),
    });
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: secret }),
      repo,
      null,
    );
    const body = JSON.stringify({
      status: "success",
      verification: {
        id: "session-1",
        attemptId: "attempt-1",
        status: "approved",
        decisionTime: "2024-01-01T00:00:00Z",
        person: { firstName: "Jane", lastName: "Doe" },
      },
    });
    const result = await svc.handleDecisionWebhook(body, sign(body), API_KEY);
    expect(result.shouldProgressIndividuals).toBe(true);
    expect(repo.setUserKycStatus).toHaveBeenCalledWith(
      "user-1",
      "approved",
      expect.any(Date),
      undefined,
    );
  });

  it("does not claim idempotency for unknown session", async () => {
    const tx = {
      insert: vi.fn(),
    };
    const db = {
      transaction: vi.fn(async (fn: (conn: unknown) => Promise<unknown>) => fn(tx)),
    };
    const repo = makeRepo({
      findByProviderSessionId: vi.fn().mockResolvedValue(null),
    });
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: secret }),
      repo,
      db as never,
    );
    const body = JSON.stringify({
      status: "success",
      verification: { id: "unknown", status: "approved" },
    });
    const result = await svc.handleDecisionWebhook(body, sign(body), API_KEY);
    expect(result.verification).toBeNull();
    expect(db.transaction).toHaveBeenCalled();
  });

  it("throws VeriffWebhookPayloadError for invalid decision schema", async () => {
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: secret }),
      makeRepo({}),
    );
    const body = JSON.stringify({ status: "success", verification: { noId: true } });
    await expect(svc.handleDecisionWebhook(body, sign(body), API_KEY)).rejects.toBeInstanceOf(
      VeriffWebhookPayloadError,
    );
  });

  it("returns shouldProgressIndividuals on idempotency replay when user already approved", async () => {
    vi.mocked(tryClaimProcessedWebhookEvent).mockResolvedValue({ claimed: false });
    const db = {
      transaction: vi.fn(async (fn: (conn: unknown) => Promise<unknown>) => fn({})),
    };
    const repo = makeRepo({
      findByProviderSessionId: vi.fn().mockResolvedValue({
        ...sampleVerification,
        status: "verified",
      }),
      getUserKycState: vi.fn().mockResolvedValue({
        kycStatus: "approved",
        kycVerifiedAt: new Date(),
      }),
      setUserKycStatus: vi.fn(),
    });
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: secret }),
      repo,
      db as never,
    );
    const body = JSON.stringify({
      status: "success",
      verification: {
        id: "session-1",
        attemptId: "attempt-1",
        status: "approved",
        decisionTime: "2024-01-01T00:00:00Z",
      },
    });
    const result = await svc.handleDecisionWebhook(body, sign(body), API_KEY);
    expect(result.shouldProgressIndividuals).toBe(true);
    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
  });
});

describe("VeriffKycService.handleEventWebhook", () => {
  const secret = "test-shared-secret";

  function sign(body: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("does not downgrade approved user on late submitted event", async () => {
    const repo = makeRepo({
      findByProviderSessionId: vi.fn().mockResolvedValue({
        ...sampleVerification,
        status: "verified",
      }),
      getUserKycWebhookState: vi.fn().mockResolvedValue({
        currentKycSessionId: "session-1",
        kycRetryCount: 0,
      }),
      getUserKycState: vi.fn().mockResolvedValue({
        kycStatus: "approved",
        kycVerifiedAt: new Date(),
      }),
      update: vi.fn(),
      setUserKycStatus: vi.fn(),
    });
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: secret }),
      repo,
      null,
    );
    const body = JSON.stringify({ id: "session-1", action: "submitted" });
    await svc.handleEventWebhook(body, sign(body), API_KEY);
    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe("VeriffKycService.createSession", () => {
  it("throws when user is already approved", async () => {
    const repo = makeRepo({
      getUserKycState: vi.fn().mockResolvedValue({
        kycStatus: "approved",
        kycVerifiedAt: new Date(),
      }),
    });
    const svc = new VeriffKycService(
      baseEnv({ VERIFF_API_KEY: API_KEY, VERIFF_SHARED_SECRET: "secret" }),
      repo,
    );
    await expect(svc.createSession("user-1", "https://example.com/cb")).rejects.toBeInstanceOf(
      KycAlreadyApprovedError,
    );
  });
});

describe("KycDecisionProcessor", () => {
  it("ignores stale session webhooks", async () => {
    const repo = makeRepo({
      findByProviderSessionId: vi.fn().mockResolvedValue(sampleVerification),
      getUserKycWebhookState: vi.fn().mockResolvedValue({
        currentKycSessionId: "other-session",
        kycRetryCount: 0,
      }),
      getUserKycState: vi.fn().mockResolvedValue({ kycStatus: "unverified", kycVerifiedAt: null }),
      update: vi.fn().mockResolvedValue(sampleVerification),
    });
    const processor = new KycDecisionProcessor(repo);
    const result = await processor.apply(
      mapVeriffDecisionToApplyInput({ id: "session-1", status: "approved" }, {}),
      null,
    );
    expect(result.appliedUserKycUpdate).toBe(false);
    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
  });

  it("does not downgrade approved user on late declined decision", async () => {
    const repo = makeRepo({
      findByProviderSessionId: vi.fn().mockResolvedValue({
        ...sampleVerification,
        status: "verified",
      }),
      getUserKycWebhookState: vi.fn().mockResolvedValue({
        currentKycSessionId: "session-1",
        kycRetryCount: 0,
      }),
      getUserKycState: vi.fn().mockResolvedValue({
        kycStatus: "approved",
        kycVerifiedAt: new Date(),
      }),
      update: vi.fn(),
      setUserKycStatus: vi.fn(),
    });
    const processor = new KycDecisionProcessor(repo);
    const result = await processor.apply(
      mapVeriffDecisionToApplyInput({ id: "session-1", status: "declined", reasonCode: 105 }, {}),
      null,
    );
    expect(repo.setUserKycStatus).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(result.shouldProgressIndividuals).toBe(false);
  });
});
