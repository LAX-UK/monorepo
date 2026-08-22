import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { KycRequiredError, type KycStatusSummary } from "../services/interfaces/kyc-service.js";
import { createLotRoutes } from "./lots.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function lotRoutesApp(opts: {
  session: { id: string; role: string; staffRole: string | null } | null;
  conditionReportService?: {
    findForBuyerOnLot: ReturnType<typeof vi.fn>;
    createRequest: ReturnType<typeof vi.fn>;
  };
  strictBidEligibilityEnabled?: boolean;
  kycService?: {
    isConfigured: () => boolean;
    enforceThreshold: ReturnType<typeof vi.fn>;
  };
}) {
  const findForBuyerOnLot = opts.conditionReportService?.findForBuyerOnLot ?? vi.fn();
  const createRequest =
    opts.conditionReportService?.createRequest ??
    vi.fn().mockResolvedValue({ isErr: () => false, isOk: () => true, value: { id: "req-1" } });

  const container = {
    env: {
      APP_ENV: "production",
      STRICT_BID_ELIGIBILITY_ENABLED: opts.strictBidEligibilityEnabled ?? false,
    },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    lotService: { getById: vi.fn(), bulkPublishOrCancel: vi.fn() },
    lotSoftDeleteService: {
      softDelete: vi.fn(),
      bulkSoftDelete: vi.fn(),
      getDeleteEligibility: vi.fn(),
    },
    saleService: { getById: vi.fn() },
    mediaUrlResolver: {},
    kycService: opts.kycService ?? { isConfigured: () => false },
    requireSubmissionsLegalEntityContext: vi.fn(),
    redis: {},
    lotLifecycleQueryService: { getSnapshotsForLots: vi.fn() },
    conditionReportService: { findForBuyerOnLot, createRequest, listForAdmin: vi.fn() },
    absenteeBidService: { schedule: vi.fn() },
    autoBidService: { setForLot: vi.fn() },
    bidService: {},
    lotReaderService: {},
    lotDocumentService: {},
  } as unknown as Container;

  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(opts.session),
  };

  const app = new Hono();
  app.route("/lots", createLotRoutes(container, authenticator));
  return { app, findForBuyerOnLot, createRequest };
}

describe("GET /lots/:id/condition-report-request", () => {
  it("returns 401 when unauthenticated", async () => {
    const { app } = lotRoutesApp({ session: null });
    const res = await app.request(`http://t/lots/${lotId}/condition-report-request`);
    expect(res.status).toBe(401);
  });

  it("returns buyer row for authenticated client", async () => {
    const row = {
      id: "req-1",
      lotId,
      requestedByUserId: "u1",
      status: "pending",
      requestNote: null,
      responseNote: null,
      createdAt: new Date(),
    };
    const { app, findForBuyerOnLot } = lotRoutesApp({
      session: { id: "u1", role: "client", staffRole: null },
    });
    findForBuyerOnLot.mockResolvedValue(row);

    const res = await app.request(`http://t/lots/${lotId}/condition-report-request`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof row };
    expect(body.data?.id).toBe("req-1");
    expect(findForBuyerOnLot).toHaveBeenCalledWith({ userId: "u1", lotId });
  });
});

describe("POST /lots/:id/condition-report-requests", () => {
  it("keeps the threshold KYC gate active when strict bid eligibility is enabled", async () => {
    const createRequest = vi.fn();
    const enforceThreshold = vi.fn().mockRejectedValue(
      new KycRequiredError({
        status: "unverified",
        requiresKyc: true,
      } as KycStatusSummary),
    );
    const { app } = lotRoutesApp({
      session: { id: "u1", role: "client", staffRole: null },
      strictBidEligibilityEnabled: true,
      kycService: {
        isConfigured: () => true,
        enforceThreshold,
      },
      conditionReportService: {
        findForBuyerOnLot: vi.fn(),
        createRequest,
      },
    });

    const res = await app.request(`http://t/lots/${lotId}/condition-report-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestNote: "Please send the report" }),
    });

    expect(res.status).toBe(402);
    expect(enforceThreshold).toHaveBeenCalledWith("u1");
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("returns existing open request on duplicate submit (idempotent)", async () => {
    const { ok } = await import("neverthrow");
    const existing = {
      id: "req-open",
      lotId,
      requestedByUserId: "u1",
      status: "pending",
      requestNote: "note",
      responseNote: null,
      createdAt: new Date(),
    };
    const { app, createRequest } = lotRoutesApp({
      session: { id: "u1", role: "client", staffRole: null },
    });
    createRequest.mockResolvedValue(ok(existing));

    const res = await app.request(`http://t/lots/${lotId}/condition-report-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestNote: "again" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("req-open");
    expect(createRequest).toHaveBeenCalledOnce();
  });

  it("returns 409 when buyer already requested for this lot", async () => {
    const { err } = await import("neverthrow");
    const { app, createRequest } = lotRoutesApp({
      session: { id: "u1", role: "client", staffRole: null },
    });
    createRequest.mockResolvedValue(
      err({
        message: "You have already requested a condition report for this lot",
        status: 409,
        code: "condition_report_already_requested",
      }),
    );

    const res = await app.request(`http://t/lots/${lotId}/condition-report-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestNote: "retry" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string; code?: string };
    expect(body.code).toBe("condition_report_already_requested");
  });
});
