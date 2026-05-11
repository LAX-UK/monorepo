import type { UserRole } from "@auction/types";
import { Hono } from "hono";
import { type Result, err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { AuthzError, LotError } from "../lib/errors.js";
import { X_LEGAL_ENTITY_ID_HEADER } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { PaymentRecord } from "../services/interfaces/payment-write.js";
import type { MyPaymentRowDTO } from "../services/payment-me-presenter.js";
import { createPaymentRoutes } from "./payments.js";

const paymentId = "11111111-1111-4111-8111-111111111111";
const entityId = "22222222-2222-4222-8222-222222222222";

type MountOptions = {
  membershipRole?: string;
  /** Authenticator session id; defaults to "u1". */
  sessionUserId?: string;
  /** Override `paymentService.listMyPaymentsForBuyerApi` (used by /payments/me tests). */
  listMyPaymentsForBuyerApi?: (
    userId: string,
    options: { status?: PaymentRecord["status"] },
  ) => Promise<{ data: MyPaymentRowDTO[] }>;
  cancelPendingAsBuyer?: (
    buyerId: string,
    paymentId: string,
  ) => Promise<Result<void, AuthzError | LotError>>;
};

function dtoFromPaymentRecord(row: PaymentRecord): MyPaymentRowDTO {
  return {
    id: row.id,
    lotId: row.lotId,
    lotTitle: "Removed lot",
    lotImageUrl: null,
    amount: row.amount,
    platformFee: row.platformFee,
    currency: "GBP",
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    invoiceUrl: row.xeroOnlineInvoiceUrl ?? null,
    invoiceNumber: row.xeroInvoiceNumber ?? null,
  };
}

function mount(role: string, opts: MountOptions = {}) {
  const sessionUserId = opts.sessionUserId ?? "u1";
  const app = new Hono();
  const paymentService = {
    listAllForAdmin: vi.fn(),
    createPendingForWinner: vi.fn(),
    markCapturedByAdmin: vi.fn().mockReturnValue({ match: (ok: () => Response) => ok() }),
    refundPayment: vi.fn().mockReturnValue({ match: (ok: () => Response) => ok() }),
    listMyPaymentsForBuyerApi:
      opts.listMyPaymentsForBuyerApi ?? vi.fn(async () => ({ data: [] as MyPaymentRowDTO[] })),
    cancelPendingAsBuyer: opts.cancelPendingAsBuyer ?? vi.fn(async () => ok<void>(undefined)),
  };
  const lotService = {
    getById: vi.fn(async (_id: string) => null),
  };
  const mediaUrlResolver = {
    resolve: vi.fn(async (v: string | null | undefined) => v ?? null),
    resolveMany: vi.fn(async (vs: (string | null | undefined)[]) => vs.map((v) => v ?? null)),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    paymentService,
    lotService,
    mediaUrlResolver,
    legalEntityRepository: {
      findActiveMembership: vi.fn().mockImplementation((userId: string, legalEntityId: string) =>
        opts.membershipRole
          ? Promise.resolve({
              userId,
              legalEntityId,
              role: opts.membershipRole,
              isPrimaryAdmin: false,
            })
          : Promise.resolve(null),
      ),
    },
    impersonationAuditService: { recordSessionTimedOut: vi.fn() },
    impersonationSessionService: { validateForRequest: vi.fn() },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn(async () =>
      sessionUserId ? { id: sessionUserId, role: role as UserRole } : null,
    ),
  };
  app.route("/payments", createPaymentRoutes(container, authenticator));
  return { app, paymentService, lotService };
}

describe("payment finance entity authorization", () => {
  it("returns 403 for accountant refund without acting entity context", async () => {
    const { app, paymentService } = mount("accountant");

    const res = await app.request(`/payments/${paymentId}/refund`, { method: "POST" });

    expect(res.status).toBe(403);
    expect(paymentService.refundPayment).not.toHaveBeenCalled();
  });

  it("returns 403 for accountant capture without finance membership", async () => {
    const { app, paymentService } = mount("accountant", { membershipRole: "viewer" });

    const res = await app.request(`/payments/${paymentId}/capture`, {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: entityId },
    });

    expect(res.status).toBe(403);
    expect(paymentService.markCapturedByAdmin).not.toHaveBeenCalled();
  });

  it("allows finance member refund for their acting entity", async () => {
    const { app, paymentService } = mount("accountant", { membershipRole: "finance" });

    const res = await app.request(`/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: entityId },
    });

    expect(res.status).toBe(200);
    expect(paymentService.refundPayment).toHaveBeenCalledWith(
      "u1",
      "accountant",
      paymentId,
      entityId,
    );
  });

  it("allows administrator capture without entity context", async () => {
    const { app, paymentService } = mount("administrator");

    const res = await app.request(`/payments/${paymentId}/capture`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(paymentService.markCapturedByAdmin).toHaveBeenCalledWith(
      "u1",
      "administrator",
      paymentId,
      undefined,
    );
  });
});

describe("GET /payments/me", () => {
  function paymentRow(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
    return {
      id: "33333333-3333-4333-8333-333333333333",
      lotId: "44444444-4444-4444-8444-444444444444",
      paidByUserId: "u1",
      buyerLegalEntityId: "55555555-5555-4555-8555-555555555555",
      sellerLegalEntityId: "66666666-6666-4666-8666-666666666666",
      amount: "1500.00",
      platformFee: "75.00",
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeRefundId: null,
      status: "captured",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      ...overrides,
    };
  }

  it("returns 401 for unauthenticated requests", async () => {
    const { app, paymentService } = mount("client", { sessionUserId: "" });
    const res = await app.request("/payments/me");
    expect(res.status).toBe(401);
    expect(paymentService.listMyPaymentsForBuyerApi).not.toHaveBeenCalled();
  });

  it("delegates to listMyPaymentsForBuyerApi with the JWT userId only", async () => {
    const listMyPaymentsForBuyerApi = vi.fn(async () => ({
      data: [dtoFromPaymentRecord(paymentRow())],
    }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPaymentsForBuyerApi });
    const res = await app.request("/payments/me");
    expect(res.status).toBe(200);
    expect(listMyPaymentsForBuyerApi).toHaveBeenCalledTimes(1);
    expect(listMyPaymentsForBuyerApi).toHaveBeenCalledWith("alice", {});
  });

  it("does not allow the client to override the buyerId via query parameters", async () => {
    const listMyPaymentsForBuyerApi = vi.fn(async () => ({ data: [] }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPaymentsForBuyerApi });
    const res = await app.request("/payments/me?buyerId=bob&userId=bob&paidByUserId=bob");
    expect(res.status).toBe(200);
    expect(listMyPaymentsForBuyerApi).toHaveBeenCalledWith("alice", {});
  });

  it("does not include rows that do not belong to the caller (cross-user isolation)", async () => {
    const aliceRow = paymentRow({ id: "alice-pay", paidByUserId: "alice" });
    const bobRow = paymentRow({ id: "bob-pay", paidByUserId: "bob" });
    const listMyPaymentsForBuyerApi = vi.fn(async (id: string) => ({
      data:
        id === "alice"
          ? [dtoFromPaymentRecord(aliceRow)]
          : id === "bob"
            ? [dtoFromPaymentRecord(bobRow)]
            : [],
    }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPaymentsForBuyerApi });
    const res = await app.request("/payments/me");
    const body = (await res.json()) as { data: { id: string }[] };
    const ids = body.data.map((r) => r.id);
    expect(ids).toContain("alice-pay");
    expect(ids).not.toContain("bob-pay");
  });

  it("respects the optional ?status filter", async () => {
    const captured = paymentRow({ id: "c", status: "captured" });
    const refunded = paymentRow({ id: "r", status: "refunded" });
    const pending = paymentRow({ id: "p", status: "pending" });
    const listMyPaymentsForBuyerApi = vi.fn(async (_userId, options) => {
      const rows = [captured, refunded, pending];
      const filtered = options.status ? rows.filter((r) => r.status === options.status) : rows;
      return { data: filtered.map(dtoFromPaymentRecord) };
    });
    const { app } = mount("client", { sessionUserId: "alice", listMyPaymentsForBuyerApi });

    const res = await app.request("/payments/me?status=refunded");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string }[] };
    expect(body.data.map((r) => r.id)).toEqual(["r"]);
  });

  it("rejects unknown status values with 400", async () => {
    const listMyPaymentsForBuyerApi = vi.fn(async () => ({ data: [] }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPaymentsForBuyerApi });
    const res = await app.request("/payments/me?status=bogus");
    expect(res.status).toBe(400);
    expect(listMyPaymentsForBuyerApi).not.toHaveBeenCalled();
  });

  it("does not leak Stripe identifiers in the response payload", async () => {
    const row = paymentRow({
      stripePaymentIntentId: "pi_secret",
      stripeChargeId: "ch_secret",
      stripeRefundId: "re_secret",
    });
    const { app } = mount("client", {
      sessionUserId: "alice",
      listMyPaymentsForBuyerApi: vi.fn(async () => ({ data: [dtoFromPaymentRecord(row)] })),
    });
    const res = await app.request("/payments/me");
    const text = await res.text();
    expect(text).not.toContain("pi_secret");
    expect(text).not.toContain("ch_secret");
    expect(text).not.toContain("re_secret");
  });

  it("returns a stable buyer-facing JSON contract for each row", async () => {
    const row = paymentRow();
    const { app } = mount("client", {
      sessionUserId: "alice",
      listMyPaymentsForBuyerApi: vi.fn(async () => ({ data: [dtoFromPaymentRecord(row)] })),
    });
    const res = await app.request("/payments/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: MyPaymentRowDTO[] };
    expect(body.data).toHaveLength(1);
    const first = body.data[0];
    if (!first) throw new Error("expected row");
    const keys = Object.keys(first).sort();
    expect(keys).toEqual(
      [
        "amount",
        "createdAt",
        "currency",
        "id",
        "invoiceNumber",
        "invoiceUrl",
        "lotId",
        "lotImageUrl",
        "lotTitle",
        "platformFee",
        "status",
      ].sort(),
    );
  });
});

describe("POST /payments/me/:id/cancel-pending", () => {
  it("returns 401 when unauthenticated", async () => {
    const { app, paymentService } = mount("client", { sessionUserId: "" });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(401);
    expect(paymentService.cancelPendingAsBuyer).not.toHaveBeenCalled();
  });

  it("returns 403 for roles that cannot place bids", async () => {
    const { app, paymentService } = mount("accountant", { sessionUserId: "u1" });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(403);
    expect(paymentService.cancelPendingAsBuyer).not.toHaveBeenCalled();
  });

  it("delegates to cancelPendingAsBuyer with the session user id", async () => {
    const cancelPendingAsBuyer = vi.fn(async () => ok<void>(undefined));
    const { app, paymentService } = mount("client", {
      sessionUserId: "alice",
      cancelPendingAsBuyer,
    });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(paymentService.cancelPendingAsBuyer).toHaveBeenCalledWith("alice", paymentId);
  });

  it("maps service errors to HTTP status", async () => {
    const cancelPendingAsBuyer = vi.fn(async () =>
      err(new LotError("Only pending payments can be cancelled", 409)),
    );
    const { app } = mount("client", { sessionUserId: "alice", cancelPendingAsBuyer });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("pending");
  });

  it("maps authorization errors from the service", async () => {
    const cancelPendingAsBuyer = vi.fn(async () =>
      err(new AuthzError("Only the buyer can cancel this payment", 403)),
    );
    const { app } = mount("client", { sessionUserId: "alice", cancelPendingAsBuyer });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(403);
  });
});
