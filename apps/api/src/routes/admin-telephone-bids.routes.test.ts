import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { BidError } from "../lib/errors.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAdminRoutes } from "./admin.js";

const LOT_ID = "00000000-0000-4000-8000-000000000001";
const BOOKING_ID = "00000000-0000-4000-8000-0000000000b1";
const BUYER_ID = "buyer-user";
const BUYER_ENTITY = "00000000-0000-4000-8000-0000000000e1";

function buildTelephoneBidApp() {
  const placeBidWithIdempotency = vi.fn().mockResolvedValue({
    type: "ok",
    body: { data: { id: "bid-1", amount: "500.00" } },
  });
  const placeBid = vi.fn();

  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      disputeCases: { countOpenCases: vi.fn().mockResolvedValue(0) },
    },
    telephoneBidBookingService: {
      countGlobalPending: vi.fn().mockResolvedValue(0),
      assertBookingAllowsTelephoneBid: vi.fn().mockResolvedValue(
        ok({
          userId: BUYER_ID,
          buyerLegalEntityId: BUYER_ENTITY,
        }),
      ),
    },
    onsiteEventRsvpService: { listAdminEvents: vi.fn().mockResolvedValue([]) },
    repoFactory: {
      root: {
        lot: {
          findById: vi.fn().mockResolvedValue({
            id: LOT_ID,
            saleId: "00000000-0000-4000-8000-000000000002",
          }),
        },
      },
    },
    bidService: { placeBidWithIdempotency, placeBid },
    saleroomOnBlockPolicy: {
      assertLotOnBlock: vi.fn().mockResolvedValue(ok(undefined)),
    },
  } as unknown as Container;

  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "super_admin" }),
  };

  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, placeBidWithIdempotency, placeBid };
}

describe("POST /admin/saleroom/telephone-bids", () => {
  it("routes telephone booking bids through placeBidWithIdempotency", async () => {
    const { app, placeBidWithIdempotency, placeBid } = buildTelephoneBidApp();
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
    expect(placeBidWithIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        placedByUserId: BUYER_ID,
        lotId: LOT_ID,
        amount: 500,
        placedVia: "telephone",
        telephoneBookingId: BOOKING_ID,
        clerkUserId: "clerk-1",
        idempotencyKey: `telephone-booking:${LOT_ID}:${BOOKING_ID}:500`,
      }),
    );
    expect(placeBid).not.toHaveBeenCalled();
  });

  it("honours explicit Idempotency-Key header over booking-derived key", async () => {
    const { app, placeBidWithIdempotency } = buildTelephoneBidApp();
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

    expect(placeBidWithIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "clerk-confirm-abc123" }),
    );
  });

  it("rejects a booking that belongs to a different buyer", async () => {
    const { app, placeBidWithIdempotency, placeBid } = buildTelephoneBidApp();
    const res = await app.request("http://test/admin/saleroom/telephone-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lotId: LOT_ID,
        buyerUserId: "different-buyer",
        buyerLegalEntityId: BUYER_ENTITY,
        amount: 500,
        telephoneBookingId: BOOKING_ID,
      }),
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      code: "telephone_booking_buyer_mismatch",
    });
    expect(placeBidWithIdempotency).not.toHaveBeenCalled();
    expect(placeBid).not.toHaveBeenCalled();
  });

  it("derives clerk idempotency key when telephone booking id is absent", async () => {
    const { app, placeBidWithIdempotency, placeBid } = buildTelephoneBidApp();
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
    expect(placeBidWithIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `telephone-clerk:${LOT_ID}:clerk-1:${BUYER_ID}:500`,
      }),
    );
    expect(placeBid).not.toHaveBeenCalled();
  });

  it("returns lot_not_on_block when saleroom policy rejects", async () => {
    const placeBidWithIdempotencyReject = vi.fn();
    const customContainer = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
      admin: {
        requestLifecycle: {
          isSuspended: vi.fn().mockResolvedValue(false),
          reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
        },
        disputeCases: { countOpenCases: vi.fn().mockResolvedValue(0) },
      },
      telephoneBidBookingService: {
        countGlobalPending: vi.fn().mockResolvedValue(0),
        assertBookingAllowsTelephoneBid: vi.fn().mockResolvedValue(
          ok({
            userId: BUYER_ID,
            buyerLegalEntityId: BUYER_ENTITY,
          }),
        ),
      },
      onsiteEventRsvpService: { listAdminEvents: vi.fn().mockResolvedValue([]) },
      repoFactory: {
        root: {
          lot: {
            findById: vi.fn().mockResolvedValue({
              id: LOT_ID,
              saleId: "00000000-0000-4000-8000-000000000002",
            }),
          },
        },
      },
      bidService: { placeBidWithIdempotency: placeBidWithIdempotencyReject, placeBid: vi.fn() },
      saleroomOnBlockPolicy: {
        assertLotOnBlock: vi
          .fn()
          .mockResolvedValue(
            err(new BidError("This lot is not on the block", 400, "lot_not_on_block")),
          ),
      },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "clerk-1", role: "staff", staffRole: "super_admin" }),
    };
    const rejectApp = new Hono();
    rejectApp.route("/admin", createAdminRoutes(customContainer, authenticator));
    const res = await rejectApp.request("http://test/admin/saleroom/telephone-bids", {
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
    expect(placeBidWithIdempotencyReject).not.toHaveBeenCalled();
  });
});
