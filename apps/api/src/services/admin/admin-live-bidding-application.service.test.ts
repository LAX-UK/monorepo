import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../../lib/errors.js";
import { AdminLiveBiddingApplicationService } from "./admin-live-bidding-application.service.js";
import type { AdminLiveBiddingApplicationServiceDeps } from "./admin-live-bidding-application.service.js";

const SALE_ID = "00000000-0000-4000-8000-000000000002";
const LOT_ID = "00000000-0000-4000-8000-000000000001";

function buildService(overrides: Partial<AdminLiveBiddingApplicationServiceDeps> = {}) {
  const publishClerkPaddleBidSummary = vi.fn().mockResolvedValue(undefined);
  const recordOutcome = vi.fn();
  const logPlaced = vi.fn();

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
    ...overrides,
  });

  return { service, publishClerkPaddleBidSummary, recordOutcome, logPlaced };
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
});
