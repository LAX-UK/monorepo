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

function buildLiveBiddingApp(partial: {
  liveBidding?: Partial<Container["admin"]["liveBidding"]>;
  saleroom?: Partial<Container["admin"]["saleroom"]>;
}) {
  const placePaddleBid = vi.fn().mockResolvedValue({
    type: "ok_with_summary",
    body: { data: { id: "bid-paddle-1", amount: "500.00" } },
    bidCount: 2,
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
  const publishClerkPaddleBidSummary = vi.fn().mockResolvedValue(undefined);

  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      disputeCases: { countOpenCases: vi.fn().mockResolvedValue(0) },
      liveBidding: {
        placePaddleBid,
        placeTelephoneBid,
        assignPaddle,
        clearPaddle,
        listSaleRoster,
        ...partial.liveBidding,
      },
      saleroom: {
        publishClerkPaddleBidSummary,
        ...partial.saleroom,
      },
    },
    telephoneBidBookingService: { countGlobalPending: vi.fn().mockResolvedValue(0) },
    onsiteEventAdminService: { listAdminEvents: vi.fn().mockResolvedValue([]) },
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
    placePaddleBid,
    placeTelephoneBid,
    assignPaddle,
    clearPaddle,
    listSaleRoster,
    publishClerkPaddleBidSummary,
  };
}

describe("admin live bidding routes (DIP facade)", () => {
  it("POST /admin/saleroom/paddle-bids uses admin.liveBidding and publishes summary", async () => {
    const { app, placePaddleBid, publishClerkPaddleBidSummary } = buildLiveBiddingApp({});
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
    expect(placePaddleBid).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 500,
        clerkUserId: "clerk-1",
      }),
    );
    expect(publishClerkPaddleBidSummary).toHaveBeenCalledWith({
      saleId: SALE_ID,
      lotId: LOT_ID,
      currentPrice: "500.00",
      bidCount: 2,
      leaderPaddleNumber: 142,
    });
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
    const placePaddleBid = vi.fn().mockResolvedValue({
      type: "err",
      error: new BidError("Lot is not on block", 409, "lot_not_on_block"),
    });
    const { app } = buildLiveBiddingApp({ liveBidding: { placePaddleBid } as never });
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
