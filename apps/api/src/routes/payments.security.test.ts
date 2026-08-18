import type { PaymentRecord } from "@auction/persistence/interfaces";
import type { UserRole } from "@auction/types";
import type { UserStaffRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerPaymentHttpRoutesSlice } from "../container.js";
import { X_LEGAL_ENTITY_ID_HEADER } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { MyPaymentRowDTO } from "../services/payment-me-presenter.js";
import { createPaymentRoutes } from "./payments.js";

const paymentId = "11111111-1111-4111-8111-111111111111";
const entityId = "22222222-2222-4222-8222-222222222222";

type MountOptions = {
  membershipRole?: string;
  staffRole?: string;
  /** Authenticator session id; defaults to "u1". */
  sessionUserId?: string;
  listMyPayments?: (
    userId: string,
    options: { status?: PaymentRecord["status"] },
  ) => Promise<{ kind: "ok"; data: MyPaymentRowDTO[] }>;
  cancelPendingPayment?: (
    buyerId: string,
    paymentId: string,
  ) => Promise<
    | { kind: "ok"; data: { ok: true } }
    | { kind: "err"; error: { message: string; status: number; code?: string } }
  >;
  getWinnerLotFulfilment?: (
    userId: string,
    lotId: string,
  ) => Promise<
    | { kind: "ok"; data: unknown }
    | { kind: "err"; error: { message: string; status: number; code?: string } }
  >;
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
    checkoutRail: null,
    manualReviewReason: null,
  };
}

function mount(role: string, opts: MountOptions = {}) {
  const sessionUserId = opts.sessionUserId ?? "u1";
  const app = new Hono();
  const entityStaffPayment = {
    listAllForAdmin: vi.fn(),
    markCapturedByAdmin: vi.fn().mockReturnValue({ match: (okFn: () => Response) => okFn() }),
    refundPayment: vi.fn().mockReturnValue({ match: (okFn: () => Response) => okFn() }),
  };
  const buyerPaymentHttp = {
    getBuyerComplianceGate: vi.fn(),
    getBuyerSourceOfFundsView: vi.fn(),
    listMyPayments:
      opts.listMyPayments ??
      vi.fn(async () => ({ kind: "ok" as const, data: [] as MyPaymentRowDTO[] })),
    cancelPendingPayment:
      opts.cancelPendingPayment ??
      vi.fn(async () => ({ kind: "ok" as const, data: { ok: true as const } })),
    getWinnerLotFulfilment:
      opts.getWinnerLotFulfilment ?? vi.fn(async () => ({ kind: "ok" as const, data: null })),
    initiateBuyerCheckout: vi.fn(),
    attachSourceOfFundsDocument: vi.fn(),
    submitSourceOfFundsDocuments: vi.fn(),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    finance: {
      entityStaffPayment,
      buyerPaymentHttp,
    },
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
  } as unknown as ContainerPaymentHttpRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn(async () =>
      sessionUserId
        ? {
            id: sessionUserId,
            role: role as UserRole,
            staffRole: (opts.staffRole ?? null) as UserStaffRole | null,
            scopes: ["bid.read", "bid.write"],
          }
        : null,
    ),
  };
  app.route("/payments", createPaymentRoutes(container, authenticator));
  return { app, entityStaffPayment, buyerPaymentHttp };
}

describe("payment finance entity authorization", () => {
  it("returns 403 for finance staff (finance_ops) refund without acting entity context", async () => {
    const { app, entityStaffPayment } = mount("staff", { staffRole: "finance_ops" });

    const res = await app.request(`/payments/${paymentId}/refund`, { method: "POST" });

    expect(res.status).toBe(403);
    expect(entityStaffPayment.refundPayment).not.toHaveBeenCalled();
  });

  it("returns 403 for finance staff capture without finance membership", async () => {
    const { app, entityStaffPayment } = mount("staff", {
      membershipRole: "viewer",
      staffRole: "finance_ops",
    });

    const res = await app.request(`/payments/${paymentId}/capture`, {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: entityId },
    });

    expect(res.status).toBe(403);
    expect(entityStaffPayment.markCapturedByAdmin).not.toHaveBeenCalled();
  });

  it("allows finance member refund for their acting entity", async () => {
    const { app, entityStaffPayment } = mount("staff", {
      membershipRole: "finance",
      staffRole: "finance_ops",
    });

    const res = await app.request(`/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: entityId },
    });

    expect(res.status).toBe(200);
    expect(entityStaffPayment.refundPayment).toHaveBeenCalledWith(
      "u1",
      "staff",
      paymentId,
      entityId,
      "finance_ops",
    );
  });

  it("allows staff (super_admin) capture without entity context", async () => {
    const { app, entityStaffPayment } = mount("staff", { staffRole: "super_admin" });

    const res = await app.request(`/payments/${paymentId}/capture`, { method: "POST" });

    expect(res.status).toBe(200);
    expect(entityStaffPayment.markCapturedByAdmin).toHaveBeenCalledWith(
      "u1",
      "staff",
      paymentId,
      undefined,
      "super_admin",
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
    const { app, buyerPaymentHttp } = mount("client", { sessionUserId: "" });
    const res = await app.request("/payments/me");
    expect(res.status).toBe(401);
    expect(buyerPaymentHttp.listMyPayments).not.toHaveBeenCalled();
  });

  it("delegates to listMyPayments with the JWT userId only", async () => {
    const listMyPayments = vi.fn(async () => ({
      kind: "ok" as const,
      data: [dtoFromPaymentRecord(paymentRow())],
    }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPayments });
    const res = await app.request("/payments/me");
    expect(res.status).toBe(200);
    expect(listMyPayments).toHaveBeenCalledTimes(1);
    expect(listMyPayments).toHaveBeenCalledWith("alice", {});
  });

  it("does not allow the client to override the buyerId via query parameters", async () => {
    const listMyPayments = vi.fn(async () => ({ kind: "ok" as const, data: [] }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPayments });
    const res = await app.request("/payments/me?buyerId=bob&userId=bob&paidByUserId=bob");
    expect(res.status).toBe(200);
    expect(listMyPayments).toHaveBeenCalledWith("alice", {});
  });

  it("does not include rows that do not belong to the caller (cross-user isolation)", async () => {
    const aliceRow = paymentRow({ id: "alice-pay", paidByUserId: "alice" });
    const bobRow = paymentRow({ id: "bob-pay", paidByUserId: "bob" });
    const listMyPayments = vi.fn(async (id: string) => ({
      kind: "ok" as const,
      data:
        id === "alice"
          ? [dtoFromPaymentRecord(aliceRow)]
          : id === "bob"
            ? [dtoFromPaymentRecord(bobRow)]
            : [],
    }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPayments });
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
    const listMyPayments = vi.fn(async (_userId, options) => {
      const rows = [captured, refunded, pending];
      const filtered = options.status ? rows.filter((r) => r.status === options.status) : rows;
      return { kind: "ok" as const, data: filtered.map(dtoFromPaymentRecord) };
    });
    const { app } = mount("client", { sessionUserId: "alice", listMyPayments });

    const res = await app.request("/payments/me?status=refunded");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string }[] };
    expect(body.data.map((r) => r.id)).toEqual(["r"]);
  });

  it("rejects unknown status values with 400", async () => {
    const listMyPayments = vi.fn(async () => ({ kind: "ok" as const, data: [] }));
    const { app } = mount("client", { sessionUserId: "alice", listMyPayments });
    const res = await app.request("/payments/me?status=bogus");
    expect(res.status).toBe(400);
    expect(listMyPayments).not.toHaveBeenCalled();
  });

  it("does not leak Stripe identifiers in the response payload", async () => {
    const row = paymentRow({
      stripePaymentIntentId: "pi_secret",
      stripeChargeId: "ch_secret",
      stripeRefundId: "re_secret",
    });
    const { app } = mount("client", {
      sessionUserId: "alice",
      listMyPayments: vi.fn(async () => ({
        kind: "ok" as const,
        data: [dtoFromPaymentRecord(row)],
      })),
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
      listMyPayments: vi.fn(async () => ({
        kind: "ok" as const,
        data: [dtoFromPaymentRecord(row)],
      })),
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
        "checkoutRail",
        "createdAt",
        "currency",
        "id",
        "invoiceNumber",
        "invoiceUrl",
        "lotId",
        "lotImageUrl",
        "lotTitle",
        "manualReviewReason",
        "platformFee",
        "status",
      ].sort(),
    );
  });
});

describe("GET /payments/me/lot/:lotId/fulfilment", () => {
  const lotUuid = "44444444-4444-4444-8444-444444444444";

  it("returns 401 when unauthenticated", async () => {
    const { app, buyerPaymentHttp } = mount("client", { sessionUserId: "" });
    const res = await app.request(`/payments/me/lot/${lotUuid}/fulfilment`);
    expect(res.status).toBe(401);
    expect(buyerPaymentHttp.getWinnerLotFulfilment).not.toHaveBeenCalled();
  });

  it("returns 403 for roles that are not buyers", async () => {
    const { app, buyerPaymentHttp } = mount("staff", {
      sessionUserId: "u1",
      staffRole: "finance_ops",
    });
    const res = await app.request(`/payments/me/lot/${lotUuid}/fulfilment`);
    expect(res.status).toBe(403);
    expect(buyerPaymentHttp.getWinnerLotFulfilment).not.toHaveBeenCalled();
  });

  it("rejects invalid lot id with 400", async () => {
    const { app, buyerPaymentHttp } = mount("client", { sessionUserId: "alice" });
    const res = await app.request("/payments/me/lot/not-a-uuid/fulfilment");
    expect(res.status).toBe(400);
    expect(buyerPaymentHttp.getWinnerLotFulfilment).not.toHaveBeenCalled();
  });

  it("delegates to getWinnerLotFulfilment with session user and lot id", async () => {
    const getWinnerLotFulfilment = vi.fn().mockResolvedValue({
      kind: "ok",
      data: {
        id: "ff",
        lotId: lotUuid,
        paymentId: null,
        status: "awaiting_payment",
        releaseApprovedByUserId: null,
        releaseApprovedAt: null,
        fulfilmentMethod: null,
        shippingCarrier: null,
        trackingNumber: null,
        collectedBy: null,
        collectedAt: null,
        addressSnapshot: null,
        notes: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    });
    const { app } = mount("client", {
      sessionUserId: "alice",
      getWinnerLotFulfilment,
    });

    const res = await app.request(`/payments/me/lot/${lotUuid}/fulfilment`);
    expect(res.status).toBe(200);
    expect(getWinnerLotFulfilment).toHaveBeenCalledWith("alice", lotUuid);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("awaiting_payment");
  });
});

describe("POST /payments/me/:id/cancel-pending", () => {
  it("returns 401 when unauthenticated", async () => {
    const { app, buyerPaymentHttp } = mount("client", { sessionUserId: "" });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(401);
    expect(buyerPaymentHttp.cancelPendingPayment).not.toHaveBeenCalled();
  });

  it("returns 403 for roles that cannot place bids", async () => {
    const { app, buyerPaymentHttp } = mount("staff", {
      sessionUserId: "u1",
      staffRole: "finance_ops",
    });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(403);
    expect(buyerPaymentHttp.cancelPendingPayment).not.toHaveBeenCalled();
  });

  it("delegates to cancelPendingPayment with the session user id", async () => {
    const cancelPendingPayment = vi.fn(async () => ({
      kind: "ok" as const,
      data: { ok: true as const },
    }));
    const { app, buyerPaymentHttp } = mount("client", {
      sessionUserId: "alice",
      cancelPendingPayment,
    });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(200);
    expect(buyerPaymentHttp.cancelPendingPayment).toHaveBeenCalledWith("alice", paymentId);
  });

  it("maps service errors to HTTP status", async () => {
    const cancelPendingPayment = vi.fn(async () => ({
      kind: "err" as const,
      error: { message: "Only pending payments can be cancelled", status: 409 },
    }));
    const { app } = mount("client", { sessionUserId: "alice", cancelPendingPayment });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("pending");
  });

  it("maps authorization errors from the service", async () => {
    const cancelPendingPayment = vi.fn(async () => ({
      kind: "err" as const,
      error: { message: "Only the buyer can cancel this payment", status: 403 },
    }));
    const { app } = mount("client", { sessionUserId: "alice", cancelPendingPayment });
    const res = await app.request(`/payments/me/${paymentId}/cancel-pending`, { method: "POST" });
    expect(res.status).toBe(403);
  });
});
