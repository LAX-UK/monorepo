import { createHmac } from "node:crypto";
import type { IKycRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { createComplianceRouteServices } from "../../container/create-compliance-route-services.js";
import type { Env } from "../../env.js";
import { VeriffWebhookSignatureError } from "../../lib/veriff/veriff-webhook-verifier.js";
import type { ComplianceVeriffWebhookRoutesContainer } from "../../services/interfaces/compliance-routes/compliance-route-container-slices.js";
import { VeriffWebhookPayloadError } from "../../services/interfaces/kyc-service.js";
import { VeriffKycService } from "../../services/kyc/veriff-kyc.service.js";
import { createVeriffWebhookRoutes } from "./veriff.js";

const mocks = vi.hoisted(() => ({
  progressIndividualsAfterKycApproval: vi.fn(),
}));

vi.mock("../../services/kyc/kyc-post-verification-progression.js", () => ({
  progressIndividualsAfterKycApproval: mocks.progressIndividualsAfterKycApproval,
}));

const API_KEY = "test-api-key";
const SECRET = "test-shared-secret";

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    VERIFF_API_KEY: API_KEY,
    VERIFF_SHARED_SECRET: SECRET,
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
    findLatestByUserIdWithPayload: vi.fn().mockResolvedValue(null),
    getDecisionPayload: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    getPendingExposure: vi.fn().mockResolvedValue({ total: 0, currency: "GBP" }),
    setUserKycStatus: vi.fn(),
    getUserKycWebhookState: vi.fn(),
    incrementUserKycRetryCount: vi.fn(),
    getUserKycState: vi.fn(),
    ...overrides,
  };
}

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

function makeVeriffWebhookContainer(
  overrides: {
    kycService?: Container["kycService"];
    db?: Container["db"];
    transactionRunner?: Container["transactionRunner"];
    legalEntityRepository?: Container["legalEntityRepository"];
    amlService?: Container["amlService"];
    stripeConnectService?: Container["stripeConnectService"];
    marketingEventService?: Container["marketingEventService"];
    domainEventSink?: Container["domainEventSink"];
    compliance?: ComplianceVeriffWebhookRoutesContainer["compliance"];
  } = {},
): {
  container: ComplianceVeriffWebhookRoutesContainer;
  kycService: NonNullable<typeof overrides.kycService>;
  db: NonNullable<typeof overrides.db>;
  transactionRunner: NonNullable<typeof overrides.transactionRunner>;
  legalEntityRepository: NonNullable<typeof overrides.legalEntityRepository>;
  domainEventSink: Container["domainEventSink"] | undefined;
} {
  type Kyc = Parameters<typeof createComplianceRouteServices>[0]["kycService"];
  const kycService =
    overrides.kycService ??
    ({
      handleDecisionWebhook: vi.fn().mockResolvedValue({
        verification: null,
        appliedUserKycUpdate: false,
        shouldProgressIndividuals: false,
      }),
      handleEventWebhook: vi.fn().mockResolvedValue(undefined),
    } as unknown as Kyc);
  const db = overrides.db ?? ({} as Container["db"]);
  const transactionRunner =
    overrides.transactionRunner ??
    ({
      runInTransaction: vi.fn(async (fn: (tx: never) => Promise<unknown>) => fn({} as never)),
    } as Container["transactionRunner"]);
  const legalEntityRepository =
    overrides.legalEntityRepository ??
    ({
      advanceIndividualLeadsToConnectPendingAfterKyc: vi.fn().mockResolvedValue([]),
    } as unknown as Container["legalEntityRepository"]);
  const amlService =
    overrides.amlService ??
    ({
      handleWatchlistWebhook: vi.fn().mockResolvedValue({ processed: false }),
      ingestFromFetch: vi.fn().mockResolvedValue(undefined),
    } as unknown as Container["amlService"]);
  const stripeConnectService =
    overrides.stripeConnectService ?? ({} as Container["stripeConnectService"]);
  const marketingEventService =
    overrides.marketingEventService ??
    ({ enqueue: vi.fn() } as unknown as Container["marketingEventService"]);
  const domainEventSink = overrides.domainEventSink ?? undefined;
  const compliance =
    overrides.compliance ??
    createComplianceRouteServices({
      staffStepUp: { isRecent: async () => true },
      db,
      transactionRunner,
      legalEntityRepository,
      domainEventSink,
      kycService,
      amlService,
      stripeConnectService,
      marketingEventService,
      sourceOfFundsDocumentCollectionService: {
        getBuyerView: vi.fn(),
      } as never,
      uploadService: {} as never,
      exportService: {} as never,
      lotDocumentService: {} as never,
      saleDocumentService: {} as never,
      storageDriver: "s3",
      enquiryDrafts: { issue: vi.fn(), verify: vi.fn() },
    });

  return {
    container: { compliance },
    kycService,
    db,
    transactionRunner,
    legalEntityRepository,
    domainEventSink,
  };
}

describe("POST /webhooks/veriff/decision", () => {
  it("returns 401 when signature verification fails", async () => {
    const { container, kycService } = makeVeriffWebhookContainer();
    vi.mocked(kycService.handleDecisionWebhook).mockRejectedValue(
      new VeriffWebhookSignatureError("invalid_signature"),
    );
    const app = createVeriffWebhookRoutes(container);

    const res = await app.request("/decision", {
      method: "POST",
      body: "{}",
      headers: { "x-hmac-signature": "bad" },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_signature" });
  });

  it("accepts vrf-hmac-signature when x-hmac-signature is absent", async () => {
    const repo = makeRepo();
    const kycService = new VeriffKycService(baseEnv(), repo, null);
    const container = makeVeriffWebhookContainer({ kycService }).container;
    const app = createVeriffWebhookRoutes(container);
    const body = JSON.stringify({
      status: "success",
      verification: { id: "s1", status: "approved" },
    });

    const res = await app.request("/decision", {
      method: "POST",
      body,
      headers: {
        "vrf-hmac-signature": sign(body),
        "x-auth-client": API_KEY,
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, processed: false });
  });

  it("returns 400 for invalid webhook payload schema", async () => {
    const repo = makeRepo();
    const kycService = new VeriffKycService(baseEnv(), repo, null);
    const container = makeVeriffWebhookContainer({ kycService }).container;
    const app = createVeriffWebhookRoutes(container);
    const body = JSON.stringify({ status: "success", verification: { noId: true } });

    const res = await app.request("/decision", {
      method: "POST",
      body,
      headers: {
        "x-hmac-signature": sign(body),
        "x-auth-client": API_KEY,
      },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_webhook_payload" });
  });

  it("delegates verified payloads to kycService", async () => {
    const { container, kycService } = makeVeriffWebhookContainer();
    vi.mocked(kycService.handleDecisionWebhook).mockResolvedValue({
      verification: { userId: "u1" } as never,
      appliedUserKycUpdate: true,
      shouldProgressIndividuals: false,
    });
    const app = createVeriffWebhookRoutes(container);

    const res = await app.request("/decision", {
      method: "POST",
      body: JSON.stringify({ status: "success" }),
      headers: { "x-hmac-signature": "sig" },
    });

    expect(res.status).toBe(200);
    expect(kycService.handleDecisionWebhook).toHaveBeenCalled();
    expect(await res.json()).toEqual({ ok: true, processed: true });
  });

  it("runs progression when shouldProgressIndividuals is true", async () => {
    mocks.progressIndividualsAfterKycApproval.mockResolvedValue(undefined);
    const { container, kycService, transactionRunner, legalEntityRepository, domainEventSink } =
      makeVeriffWebhookContainer();
    vi.mocked(kycService.handleDecisionWebhook).mockResolvedValue({
      verification: { userId: "u1" } as never,
      appliedUserKycUpdate: false,
      shouldProgressIndividuals: true,
    });
    const app = createVeriffWebhookRoutes(container);

    const res = await app.request("/decision", {
      method: "POST",
      body: JSON.stringify({ status: "success" }),
      headers: { "x-hmac-signature": "sig" },
    });

    expect(res.status).toBe(200);
    expect(mocks.progressIndividualsAfterKycApproval).toHaveBeenCalledWith(
      {
        transactionRunner,
        legalEntityRepository,
        domainEventSink,
      },
      "u1",
    );
  });

  it("returns 500 when progression throws so Veriff retries", async () => {
    mocks.progressIndividualsAfterKycApproval.mockRejectedValue(new Error("db down"));
    const { container, kycService } = makeVeriffWebhookContainer();
    vi.mocked(kycService.handleDecisionWebhook).mockResolvedValue({
      verification: { userId: "u1" } as never,
      appliedUserKycUpdate: false,
      shouldProgressIndividuals: true,
    });
    const app = createVeriffWebhookRoutes(container);

    const res = await app.request("/decision", {
      method: "POST",
      body: JSON.stringify({ status: "success" }),
      headers: { "x-hmac-signature": "sig" },
    });

    expect(res.status).toBe(500);
  });
});

describe("POST /webhooks/veriff/event", () => {
  it("accepts vrf-hmac-signature when x-hmac-signature is absent", async () => {
    const repo = makeRepo();
    const kycService = new VeriffKycService(baseEnv(), repo, null);
    const container = makeVeriffWebhookContainer({ kycService }).container;
    const app = createVeriffWebhookRoutes(container);
    const body = JSON.stringify({ id: "session-1", action: "started" });

    const res = await app.request("/event", {
      method: "POST",
      body,
      headers: {
        "vrf-hmac-signature": sign(body),
        "x-auth-client": API_KEY,
      },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps VeriffWebhookPayloadError to 400", async () => {
    const { container, kycService } = makeVeriffWebhookContainer();
    vi.mocked(kycService.handleEventWebhook).mockRejectedValue(
      new VeriffWebhookPayloadError("invalid_webhook_payload"),
    );
    const app = createVeriffWebhookRoutes(container);

    const res = await app.request("/event", {
      method: "POST",
      body: "{}",
      headers: { "x-hmac-signature": "sig" },
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_webhook_payload" });
  });
});
