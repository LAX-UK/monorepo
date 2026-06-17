import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { BidError } from "../lib/errors.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";
const LOT_ID = "00000000-0000-4000-8000-000000000001";
const REG_ID = "00000000-0000-4000-8000-0000000000a1";

function buildPaddleApp() {
  const placeBidWithIdempotency = vi.fn().mockResolvedValue({
    type: "ok",
    body: { data: { id: "bid-paddle-1", amount: "500.00" } },
  });
  const assignPaddle = vi.fn().mockResolvedValue(ok({ paddleNumber: 142 }));
  const clearPaddle = vi.fn().mockResolvedValue(ok(undefined));
  const assertPaddleAllowsBid = vi.fn().mockResolvedValue(
    ok({
      userId: "buyer-user",
      buyerLegalEntityId: "00000000-0000-4000-8000-0000000000e1",
      registrationId: REG_ID,
    }),
  );
  const listSaleRoster = vi.fn().mockResolvedValue([
    {
      paddleNumber: 142,
      userId: "buyer-user",
      displayName: "Jane",
      bidLimit: null,
      hasActiveSelfServiceSession: false,
    },
  ]);

  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      disputeCases: { countOpenCases: vi.fn().mockResolvedValue(0) },
    },
    adminMetricsService: { recordBidPlaced: vi.fn() },
    telephoneBidBookingService: { countGlobalPending: vi.fn().mockResolvedValue(0) },
    onsiteEventRsvpService: { listAdminEvents: vi.fn().mockResolvedValue([]) },
    repoFactory: {
      root: {
        lot: {
          findById: vi.fn().mockResolvedValue({
            id: LOT_ID,
            saleId: SALE_ID,
          }),
        },
      },
    },
    paddleService: { assignPaddle, clearPaddle, assertPaddleAllowsBid, listSaleRoster },
    bidService: { placeBidWithIdempotency },
    saleroomOnBlockPolicy: {
      assertLotOnBlock: vi.fn().mockResolvedValue(ok(undefined)),
    },
    saleroomService: {
      publishClerkPaddleBidSummary: vi.fn().mockResolvedValue(undefined),
    },
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        })),
      })),
    },
    redis: {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    },
  } as unknown as Container;

  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "super_admin" }),
  };

  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return {
    app,
    placeBidWithIdempotency,
    assignPaddle,
    clearPaddle,
    assertPaddleAllowsBid,
    listSaleRoster,
  };
}

describe("paddle admin routes", () => {
  it("POST /admin/saleroom/paddle-bids resolves paddle and places bid", async () => {
    const { app, placeBidWithIdempotency, assertPaddleAllowsBid } = buildPaddleApp();
    const res = await app.request("http://test/admin/saleroom/paddle-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
      }),
    });

    expect(res.status).toBe(201);
    expect(assertPaddleAllowsBid).toHaveBeenCalledWith({
      saleId: SALE_ID,
      paddleNumber: 142,
      lotId: LOT_ID,
    });
    expect(placeBidWithIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        placedVia: "saleroom",
        clerkUserId: "clerk-1",
        saleId: SALE_ID,
        paddleNumber: 142,
        idempotencyKey: `paddle:${SALE_ID}:142:${LOT_ID}:500`,
      }),
    );
  });

  it("returns lot_not_on_block when saleroom policy rejects paddle bid", async () => {
    const placeBidWithIdempotency = vi.fn();
    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
      admin: {
        requestLifecycle: {
          isSuspended: vi.fn().mockResolvedValue(false),
          reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
        },
        disputeCases: { countOpenCases: vi.fn().mockResolvedValue(0) },
      },
      adminMetricsService: { recordBidPlaced: vi.fn() },
      telephoneBidBookingService: { countGlobalPending: vi.fn().mockResolvedValue(0) },
      onsiteEventRsvpService: { listAdminEvents: vi.fn().mockResolvedValue([]) },
      repoFactory: {
        root: {
          lot: {
            findById: vi.fn().mockResolvedValue({
              id: LOT_ID,
              saleId: SALE_ID,
            }),
          },
        },
      },
      paddleService: {
        assignPaddle: vi.fn(),
        clearPaddle: vi.fn(),
        assertPaddleAllowsBid: vi.fn(),
        listSaleRoster: vi.fn(),
      },
      bidService: { placeBidWithIdempotency },
      saleroomOnBlockPolicy: {
        assertLotOnBlock: vi
          .fn()
          .mockResolvedValue(
            err(new BidError("This lot is not on the block", 400, "lot_not_on_block")),
          ),
      },
      redis: { incr: vi.fn(), expire: vi.fn() },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "super_admin" }),
    };
    const app = new Hono();
    app.route("/admin", createAdminRoutes(container, authenticator));
    const res = await app.request("http://test/admin/saleroom/paddle-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("lot_not_on_block");
    expect(placeBidWithIdempotency).not.toHaveBeenCalled();
  });

  it("POST assign paddle returns 409 from service", async () => {
    const { app, assignPaddle } = buildPaddleApp();
    assignPaddle.mockResolvedValueOnce(
      err({
        message: "Paddle number is already assigned in this sale",
        status: 409,
        code: "paddle_taken",
      }),
    );
    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${REG_ID}/paddle`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paddleNumber: 142 }),
      },
    );
    expect(res.status).toBe(409);
  });

  it("GET paddle roster returns items", async () => {
    const { app, listSaleRoster } = buildPaddleApp();
    const res = await app.request(`http://test/admin/sales/${SALE_ID}/paddles`);
    expect(res.status).toBe(200);
    expect(listSaleRoster).toHaveBeenCalledWith(SALE_ID);
    const body = (await res.json()) as { data: { items: unknown[] } };
    expect(body.data.items).toHaveLength(1);
  });
});
