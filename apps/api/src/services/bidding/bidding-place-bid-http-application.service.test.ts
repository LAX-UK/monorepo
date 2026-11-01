import { describe, expect, it, vi } from "vitest";
import { BidError } from "../../lib/errors.js";
import { BiddingPlaceBidHttpApplicationService } from "./bidding-place-bid-http-application.service.js";

describe("BiddingPlaceBidHttpApplicationService refusals", () => {
  it("tells the observer about a refused bid with what it committed to, and answers at once", async () => {
    const error = new BidError("past limit", 403, "organisation_limit_exceeded", {
      limit: "50000.00",
      available: "0.00",
    });
    const refused = vi.fn(async () => undefined);
    const service = new BiddingPlaceBidHttpApplicationService(
      {
        placeBidWithIdempotency: vi.fn(async () => ({ type: "err" as const, error })),
        placeBid: vi.fn(),
      } as never,
      { refused },
    );
    const outcome = await service.placeBid({
      placedByUserId: "tom",
      buyerLegalEntityId: "org-1",
      lotId: "lot-1",
      amount: 4000,
      maxAutoBidAmount: 4800,
    });
    expect(outcome).toMatchObject({ kind: "err", error: { status: 403 } });
    expect(refused).toHaveBeenCalledWith({
      placedByUserId: "tom",
      buyerLegalEntityId: "org-1",
      lotId: "lot-1",
      amount: 4800,
      error,
    });
  });

  it("works without an observer", async () => {
    const service = new BiddingPlaceBidHttpApplicationService({
      placeBidWithIdempotency: vi.fn(async () => ({
        type: "err" as const,
        error: new BidError("closed", 409, "lot_closed"),
      })),
      placeBid: vi.fn(),
    } as never);
    expect(
      (await service.placeBid({ placedByUserId: "tom", lotId: "lot-1", amount: 1 })).kind,
    ).toBe("err");
  });

  describe("typed refusals", () => {
    async function refusedWith(error: BidError) {
      const service = new BiddingPlaceBidHttpApplicationService({
        placeBidWithIdempotency: vi.fn(async () => ({ type: "err" as const, error })),
        placeBid: vi.fn(),
      } as never);
      return service.placeBid({ placedByUserId: "tom", lotId: "lot-1", amount: 1 });
    }

    it("answers a limit refusal as over_limit with the room left", async () => {
      const outcome = await refusedWith(
        new BidError("past limit", 403, "organisation_limit_exceeded", {
          limit: "500.00",
          available: "120.00",
        }),
      );
      expect(outcome).toMatchObject({
        kind: "err",
        error: { status: 403, code: "over_limit", details: { remaining: "120.00" } },
      });
    });

    it("answers registration refusals with their typed codes", async () => {
      expect(
        await refusedWith(new BidError("register", 403, "sale_registration_required")),
      ).toMatchObject({ error: { code: "registration_required" } });
      expect(
        await refusedWith(new BidError("waiting", 403, "sale_registration_pending")),
      ).toMatchObject({ error: { code: "registration_pending" } });
    });

    it("passes already-typed and unrelated codes through with their payload", async () => {
      expect(
        await refusedWith(
          new BidError("low", 400, "amount_invalid", { nearestValidAmount: "110.00" }),
        ),
      ).toMatchObject({
        error: { code: "amount_invalid", details: { nearestValidAmount: "110.00" } },
      });
      expect(await refusedWith(new BidError("lead", 400, "already_leading"))).toMatchObject({
        error: { code: "already_leading" },
      });
    });
  });
});
