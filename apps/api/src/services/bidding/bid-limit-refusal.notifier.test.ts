import { describe, expect, it, vi } from "vitest";
import { BidLimitRefusalNotifier, type RefusedBid } from "./bid-limit-refusal.notifier.js";

function setup() {
  const dispatch = vi.fn(async (_userId: string, _payload: unknown) => undefined);
  const notifier = new BidLimitRefusalNotifier({
    dispatcher: { dispatch },
    recipients: { listUserIdsForAudience: vi.fn(async () => ["maya", "tom", "daniel"]) } as never,
    lots: { titleOf: async () => "Red chair, evening" },
    people: { nameOf: async () => "Tom Whitfield" },
    organisations: { nameOf: async () => "Northbank Gallery" },
  });
  return { notifier, dispatch };
}

const bid = (code: string, details: Record<string, string> | undefined): RefusedBid => ({
  placedByUserId: "tom",
  buyerLegalEntityId: "org-1",
  lotId: "lot-1",
  amount: 4200,
  error: { code, details },
});

describe("BidLimitRefusalNotifier", () => {
  it("tells the bidder and the owners and admins when the organisation's limit stopped a bid", async () => {
    const { notifier, dispatch } = setup();
    await notifier.refused(
      bid("organisation_limit_exceeded", { limit: "50000.00", available: "2000.00" }),
    );
    expect(dispatch.mock.calls.map((call) => call[0])).toEqual(["tom", "maya", "daniel"]);
    expect(dispatch).toHaveBeenCalledWith(
      "tom",
      expect.objectContaining({
        type: "bid_refused_limit",
        legalEntityId: "org-1",
        lotId: "lot-1",
        title: 'Your bid on "Red chair, evening" wasn\'t placed',
        message: expect.stringContaining("past its bidding limit of £50,000.00"),
        meta: { outboxIdempotencyKey: "bid-refused-limit:lot-1:tom:organisation:4200.00" },
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      "maya",
      expect.objectContaining({
        message: expect.stringContaining("Tom Whitfield's bid of £4,200.00"),
      }),
    );
  });

  it("tells only the bidder about their own authorisation limit", async () => {
    const { notifier, dispatch } = setup();
    await notifier.refused(bid("bid_limit_exceeded", { limit: "2000.00", available: "2000.00" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      "tom",
      expect.objectContaining({ message: expect.stringContaining("You can bid up to £2,000.00") }),
    );
  });

  it("ignores other refusals and bids without an account", async () => {
    const { notifier, dispatch } = setup();
    await notifier.refused(bid("lot_closed", undefined));
    await notifier.refused({
      ...bid("organisation_limit_exceeded", { limit: "1", available: "0" }),
      buyerLegalEntityId: null,
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("never throws when a notice can't be sent", async () => {
    const { notifier, dispatch } = setup();
    dispatch.mockRejectedValue(new Error("down"));
    await expect(
      notifier.refused(bid("organisation_limit_exceeded", { limit: "1", available: "0" })),
    ).resolves.toBeUndefined();
  });
});
