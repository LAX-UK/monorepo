import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../../lib/errors.js";
import { AdminLiveBiddingApplicationService } from "./admin-live-bidding-application.service.js";
import type { AdminLiveBiddingApplicationServiceDeps } from "./admin-live-bidding-application.service.js";
import { StaffBidLimitRefusalRecorder } from "./staff-bid-limit-refusal.recorder.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";
const LOT_ID = "00000000-0000-4000-8000-000000000001";

function buildService(overrides: Partial<AdminLiveBiddingApplicationServiceDeps> = {}) {
  const publishClerkPaddleBidSummary = vi.fn().mockResolvedValue(undefined);
  const recordOutcome = vi.fn();
  const logPlaced = vi.fn();
  const publish = vi.fn(async (_event: unknown) => undefined);
  const events = { publish, withTx: vi.fn() };

  const service = new AdminLiveBiddingApplicationService({
    bidPlacer: {
      placeBidWithIdempotency: vi.fn().mockResolvedValue({
        type: "ok",
        body: { data: { id: "bid-1", amount: "500.00" } },
      }),
    },
    onBlockPolicy: {
      assertLotOnBlock: vi.fn().mockResolvedValue(ok(undefined)),
    },
    paddleClerk: {
      assertPaddleAllowsBid: vi.fn().mockResolvedValue(
        ok({
          userId: "buyer-1",
          buyerLegalEntityId: "le-1",
          registrationId: "reg-1",
        }),
      ),
      assignPaddle: vi.fn(),
      clearPaddle: vi.fn(),
      listSaleRoster: vi.fn(),
    },
    telephoneBookings: { assertBookingAllowsTelephoneBid: vi.fn() },
    adminMetrics: { recordBidPlaced: vi.fn() },
    bidRepo: { countForLot: vi.fn().mockResolvedValue(3) } as never,
    redis: {} as never,
    findLotById: vi.fn(),
    clerkPaddleBidSummaryPublisher: { publishClerkPaddleBidSummary },
    clerkPaddleBidTelemetry: { recordOutcome, logPlaced },
    limitRefusals: new StaffBidLimitRefusalRecorder(events as never),
    ...overrides,
  });

  return { service, publishClerkPaddleBidSummary, recordOutcome, logPlaced, publish };
}

describe("AdminLiveBiddingApplicationService", () => {
  it("placeClerkPaddleBid publishes summary and records ok telemetry", async () => {
    const { service, publishClerkPaddleBidSummary, recordOutcome } = buildService();
    const out = await service.placeClerkPaddleBid({
      saleId: SALE_ID,
      lotId: LOT_ID,
      paddleNumber: 142,
      amount: 500,
      clerkUserId: "clerk-1",
    });

    expect(out.httpStatus).toBe(201);
    expect(publishClerkPaddleBidSummary).toHaveBeenCalledWith({
      saleId: SALE_ID,
      lotId: LOT_ID,
      currentPrice: "500.00",
      bidCount: 3,
      leaderPaddleNumber: 142,
    });
    expect(recordOutcome).toHaveBeenCalledWith("ok");
  });

  it("placeClerkPaddleBid maps on-block rejection to HTTP error", async () => {
    const { service, publishClerkPaddleBidSummary, recordOutcome } = buildService({
      onBlockPolicy: {
        assertLotOnBlock: vi
          .fn()
          .mockResolvedValue(err(new BidError("Lot is not on block", 409, "lot_not_on_block"))),
      },
    });

    const out = await service.placeClerkPaddleBid({
      saleId: SALE_ID,
      lotId: LOT_ID,
      paddleNumber: 142,
      amount: 500,
      clerkUserId: "clerk-1",
    });

    expect(out.httpStatus).toBe(409);
    expect(out.body).toEqual({ error: "Lot is not on block", code: "lot_not_on_block" });
    expect(publishClerkPaddleBidSummary).not.toHaveBeenCalled();
    expect(recordOutcome).toHaveBeenCalledWith("error");
  });

  it("placePaddleBid rejects when paddle is not eligible", async () => {
    const { service } = buildService({
      paddleClerk: {
        assertPaddleAllowsBid: vi
          .fn()
          .mockResolvedValue(err(new BidError("Paddle not found", 404, "paddle_not_found"))),
        assignPaddle: vi.fn(),
        clearPaddle: vi.fn(),
        listSaleRoster: vi.fn(),
      },
    });

    const out = await service.placePaddleBid({
      saleId: SALE_ID,
      lotId: LOT_ID,
      paddleNumber: 999,
      amount: 500,
      clerkUserId: "clerk-1",
    });

    expect(out.type).toBe("err");
    if (out.type === "err") {
      expect(out.error.code).toBe("paddle_not_found");
    }
  });

  describe("a bid refused at a limit", () => {
    const BOOKING_ID = "00000000-0000-4000-8000-000000000003";
    const refusedBy = (error: BidError) => vi.fn().mockResolvedValue({ type: "err", error });

    it("tells the clerk which paddle limit stopped it, and audits the refusal", async () => {
      const { service, publish } = buildService({
        bidPlacer: {
          placeBidWithIdempotency: refusedBy(
            new BidError("Bid exceeds authorized limit", 403, "bid_limit_exceeded", {
              limitKind: "paddle",
              limit: "5000.00",
            }),
          ),
        },
      });

      const out = await service.placeClerkPaddleBid({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 6000,
        clerkUserId: "clerk-1",
      });

      expect(out.httpStatus).toBe(403);
      expect(out.body).toEqual({
        error: "Bid exceeds authorized limit",
        code: "bid_limit_exceeded",
        refusal: { kind: "paddle", limit: "5000.00", available: null },
      });
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith({
        aggregateType: "lot",
        aggregateId: LOT_ID,
        eventType: "bid.staff_bid_refused_at_limit",
        payload: {
          channel: "saleroom",
          limit_kind: "paddle",
          limit: "5000.00",
          amount: "6000.00",
          sale_id: SALE_ID,
          lot_id: LOT_ID,
          bidder_user_id: "buyer-1",
          paddle_number: 142,
        },
        actorUserId: "clerk-1",
        actingLegalEntityId: "le-1",
        schemaVersion: 1,
        producer: "apps/api",
      });
    });

    it("audits a telephone bid over the booking's maximum and keeps the maximum", async () => {
      const placeBidWithIdempotency = vi.fn();
      const { service, publish } = buildService({
        findLotById: vi.fn().mockResolvedValue({ id: LOT_ID, saleId: SALE_ID }),
        bidPlacer: { placeBidWithIdempotency },
        telephoneBookings: {
          assertBookingAllowsTelephoneBid: vi.fn().mockResolvedValue(
            err({
              message: "Bid exceeds authorized telephone limit",
              status: 403,
              code: "authorized_max_exceeded",
              details: { limitKind: "telephone", limit: "8000.00" },
            }),
          ),
        },
      });

      const out = await service.placeTelephoneBid({
        lotId: LOT_ID,
        buyerUserId: "buyer-2",
        buyerLegalEntityId: "le-2",
        amount: 9000,
        clerkUserId: "clerk-1",
        telephoneBookingId: BOOKING_ID,
      });

      expect(out.type).toBe("err");
      expect(out.type === "err" && out.error.details).toEqual({
        limitKind: "telephone",
        limit: "8000.00",
      });
      expect(placeBidWithIdempotency).not.toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "bid.staff_bid_refused_at_limit",
          actorUserId: "clerk-1",
          actingLegalEntityId: "le-2",
          payload: expect.objectContaining({
            channel: "telephone",
            limit_kind: "telephone",
            limit: "8000.00",
            amount: "9000.00",
            bidder_user_id: "buyer-2",
            telephone_booking_id: BOOKING_ID,
          }),
        }),
      );
    });

    it("audits a telephone bid the organisation's own limit stopped, with the room left", async () => {
      const { service, publish } = buildService({
        findLotById: vi.fn().mockResolvedValue({ id: LOT_ID, saleId: SALE_ID }),
        telephoneBookings: {
          assertBookingAllowsTelephoneBid: vi.fn().mockResolvedValue(ok({})),
        },
        bidPlacer: {
          placeBidWithIdempotency: refusedBy(
            new BidError("Past the limit", 403, "organisation_limit_exceeded", {
              limitKind: "organisation",
              limit: "50000.00",
              available: "2000.00",
            }),
          ),
        },
      });

      await service.placeTelephoneBid({
        lotId: LOT_ID,
        buyerUserId: "buyer-2",
        buyerLegalEntityId: "le-2",
        amount: 4000,
        clerkUserId: "clerk-1",
        telephoneBookingId: BOOKING_ID,
      });

      expect(publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            limit_kind: "organisation",
            limit: "50000.00",
            available: "2000.00",
          }),
        }),
      );
    });

    it("records nothing for a refusal that is not a limit", async () => {
      const { service, publish } = buildService({
        bidPlacer: {
          placeBidWithIdempotency: refusedBy(new BidError("Lot closed", 409, "lot_closed")),
        },
      });

      const out = await service.placeClerkPaddleBid({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 600,
        clerkUserId: "clerk-1",
      });

      expect(out.body).toEqual({ error: "Lot closed", code: "lot_closed" });
      expect(publish).not.toHaveBeenCalled();
    });

    it("still tells the clerk the limit when the audit write fails", async () => {
      const failing = { publish: vi.fn().mockRejectedValue(new Error("down")), withTx: vi.fn() };
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const { service } = buildService({
        limitRefusals: new StaffBidLimitRefusalRecorder(failing as never),
        bidPlacer: {
          placeBidWithIdempotency: refusedBy(
            new BidError("Bid exceeds authorized limit", 403, "bid_limit_exceeded", {
              limitKind: "paddle",
              limit: "5000.00",
            }),
          ),
        },
      });

      const out = await service.placeClerkPaddleBid({
        saleId: SALE_ID,
        lotId: LOT_ID,
        paddleNumber: 142,
        amount: 6000,
        clerkUserId: "clerk-1",
      });

      expect(out.body).toMatchObject({ refusal: { kind: "paddle", limit: "5000.00" } });
      expect(failing.publish).toHaveBeenCalled();
      error.mockRestore();
    });
  });
});
