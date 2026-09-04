import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { AdminOperationsSaleroomRoutesContainer } from "../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";
const LOT_ID = "00000000-0000-4000-8000-000000000001";
const REG_ID = "00000000-0000-4000-8000-0000000000a1";

function buildLiveBiddingApp(partial: {
  liveBidding?: Partial<AdminOperationsSaleroomRoutesContainer["admin"]["liveBidding"]>;
}) {
  const placeClerkPaddleBid = vi.fn().mockResolvedValue({
    httpStatus: 201,
    body: { data: { id: "bid-paddle-1", amount: "500.00" } },
  });
  const placeTelephoneBid = vi.fn().mockResolvedValue({
    type: "ok",
    body: { data: { id: "bid-tel-1", amount: "500.00" } },
  });
  const assignPaddle = vi.fn().mockResolvedValue(ok({ paddleNumber: 142 }));
  const clearPaddle = vi.fn().mockResolvedValue(ok(undefined));
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
      liveBidding: {
        placeClerkPaddleBid,
        placeTelephoneBid,
        assignPaddle,
        clearPaddle,
        listSaleRoster,
        ...partial.liveBidding,
      },
      onsiteEvents: { listAdminEvents: vi.fn().mockResolvedValue([]) },
    },
    redis: {
      multi: () => ({
        zadd: vi.fn().mockReturnThis(),
        zremrangebyscore: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 0],
          [null, 1],
          [null, 0],
        ]),
      }),
    },
  } as unknown as AdminOperationsSaleroomRoutesContainer & {
    env: never;
    redis: unknown;
    admin: AdminOperationsSaleroomRoutesContainer["admin"] & {
      disputeCases: unknown;
      onsiteEvents: unknown;
    };
  };

  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "clerk-1",
      role: "staff",
      staffRole: "super_admin",
      scopes: ["bid.write"],
    }),
  };

  const app = new Hono();
  app.route("/admin", createAdminRoutes(container as never, authenticator));
  return {
    app,
    placeClerkPaddleBid,
    placeTelephoneBid,
    assignPaddle,
    clearPaddle,
    listSaleRoster,
  };
}

describe("admin live bidding routes (DIP facade)", () => {
  it("POST /admin/saleroom/paddle-bids uses admin.liveBidding.placeClerkPaddleBid", async () => {
    const { app, placeClerkPaddleBid } = buildLiveBiddingApp({});
    const res = await app.request("http://test/admin/saleroom/paddle-bids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
      }),
    });

    expect(res.status).toBe(201);
    expect(placeClerkPaddleBid).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
        clerkUserId: "clerk-1",
      }),
    );
  });

  it("POST /admin/saleroom/telephone-bids uses admin.liveBidding", async () => {
    const { app, placeTelephoneBid } = buildLiveBiddingApp({});
    const res = await app.request("http://test/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lotId: LOT_ID,
        buyerUserId: "buyer-user",
        buyerLegalEntityId: "00000000-0000-4000-8000-0000000000e1",
        amount: 500,
      }),
    });

    expect(res.status).toBe(201);
    expect(placeTelephoneBid).toHaveBeenCalledWith(
      expect.objectContaining({
        lotId: LOT_ID,
        buyerUserId: "buyer-user",
        clerkUserId: "clerk-1",
        amount: 500,
      }),
    );
  });

  it("POST paddle assign maps rate_limited from facade to 429", async () => {
    const assignPaddle = vi
      .fn()
      .mockResolvedValue(
        err({ message: "Too many paddle assignments", status: 429, code: "rate_limited" }),
      );
    const { app } = buildLiveBiddingApp({ liveBidding: { assignPaddle } as never });
    const res = await app.request(
      `http://test/admin/sales/${SALE_ID}/registrations/${REG_ID}/paddle`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paddleNumber: 142 }),
      },
    );

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many paddle assignments",
      code: "rate_limited",
    });
  });

  it("POST paddle-bids maps on-block failure to HTTP status", async () => {
    const placeClerkPaddleBid = vi.fn().mockResolvedValue({
      httpStatus: 409,
      body: { error: "Lot is not on block", code: "lot_not_on_block" },
    });
    const { app } = buildLiveBiddingApp({ liveBidding: { placeClerkPaddleBid } as never });
    const res = await app.request("http://test/admin/saleroom/paddle-bids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
      }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Lot is not on block",
      code: "lot_not_on_block",
    });
  });
});
