import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { BidError } from "../lib/errors.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const LOT_ID = "00000000-0000-4000-8000-000000000001";
const BOOKING_ID = "00000000-0000-4000-8000-0000000000b1";
const BUYER_ID = "buyer-user";
const BUYER_ENTITY = "00000000-0000-4000-8000-0000000000e1";

function buildTelephoneBidApp(placeTelephoneBid?: ReturnType<typeof vi.fn>) {
  const bidFn =
    placeTelephoneBid ??
    vi.fn().mockResolvedValue({
      type: "ok",
      body: { data: { id: "bid-1", amount: "500.00" } },
    });

  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      disputeCases: { countOpenCases: vi.fn().mockResolvedValue(0) },
      liveBidding: { placeTelephoneBid: bidFn },
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
  return { app, placeTelephoneBid: bidFn };
}

describe("POST /admin/saleroom/telephone-bids", () => {
  it("routes telephone booking bids through admin.liveBidding", async () => {
    const placeTelephoneBid = vi.fn().mockResolvedValue({
      type: "ok",
      body: { data: { id: "bid-1", amount: "500.00" } },
    });
    const { app } = buildTelephoneBidApp(placeTelephoneBid);
    const res = await app.request("http://test/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotId: LOT_ID,
        buyerUserId: BUYER_ID,
        buyerLegalEntityId: BUYER_ENTITY,
        amount: 500,
        telephoneBookingId: BOOKING_ID,
      }),
    });

    expect(res.status).toBe(201);
    expect(placeTelephoneBid).toHaveBeenCalledWith(
      expect.objectContaining({
        lotId: LOT_ID,
        buyerUserId: BUYER_ID,
        buyerLegalEntityId: BUYER_ENTITY,
        amount: 500,
        telephoneBookingId: BOOKING_ID,
        clerkUserId: "clerk-1",
        idempotencyKey: `telephone-booking:${LOT_ID}:${BOOKING_ID}:500`,
      }),
    );
  });

  it("honours explicit Idempotency-Key header over booking-derived key", async () => {
    const placeTelephoneBid = vi.fn().mockResolvedValue({
      type: "ok",
      body: { data: { id: "bid-1", amount: "500.00" } },
    });
    const { app } = buildTelephoneBidApp(placeTelephoneBid);
    await app.request("http://test/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "clerk-confirm-abc123",
      },
      body: JSON.stringify({
        lotId: LOT_ID,
        buyerUserId: BUYER_ID,
        buyerLegalEntityId: BUYER_ENTITY,
        amount: 500,
        telephoneBookingId: BOOKING_ID,
      }),
    });

    expect(placeTelephoneBid).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "clerk-confirm-abc123" }),
    );
  });

  it("derives clerk idempotency key when telephone booking id is absent", async () => {
    const placeTelephoneBid = vi.fn().mockResolvedValue({
      type: "ok",
      body: { data: { id: "bid-1", amount: "500.00" } },
    });
    const { app } = buildTelephoneBidApp(placeTelephoneBid);
    const res = await app.request("http://test/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotId: LOT_ID,
        buyerUserId: BUYER_ID,
        buyerLegalEntityId: BUYER_ENTITY,
        amount: 500,
      }),
    });

    expect(res.status).toBe(201);
    expect(placeTelephoneBid).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `telephone-clerk:${LOT_ID}:clerk-1:${BUYER_ID}:500`,
      }),
    );
  });

  it("returns lot_not_on_block when live bidding rejects", async () => {
    const placeTelephoneBid = vi.fn().mockResolvedValue({
      type: "err",
      error: new BidError("This lot is not on the block", 400, "lot_not_on_block"),
    });
    const { app } = buildTelephoneBidApp(placeTelephoneBid);
    const res = await app.request("http://test/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotId: LOT_ID,
        buyerUserId: BUYER_ID,
        buyerLegalEntityId: BUYER_ENTITY,
        amount: 500,
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("lot_not_on_block");
  });
});
