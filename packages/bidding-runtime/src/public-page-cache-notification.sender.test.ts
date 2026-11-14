import type { Bid, Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { PublicPageCacheNotificationSender } from "./public-page-cache-notification.sender.js";

const lot = { id: "lot-1", saleId: "sale-1" } as Lot;
const bid = { id: "bid-1" } as Bid;

function setup() {
  const inner = {
    notifyBidPlaced: vi.fn().mockResolvedValue(undefined),
    notifyLotExtended: vi.fn().mockResolvedValue(undefined),
    notifyLotEnded: vi.fn().mockResolvedValue(undefined),
    notifyProxyCancelled: vi.fn().mockResolvedValue(undefined),
  };
  const invalidator = { invalidate: vi.fn().mockResolvedValue(undefined) };
  const onError = vi.fn();
  const sender = new PublicPageCacheNotificationSender(inner, invalidator, onError);
  return { inner, invalidator, onError, sender };
}

const LOT_TAGS = ["public-lot:lot-1", "catalogue-lots", "public-sale:sale-1"];

describe("PublicPageCacheNotificationSender", () => {
  it("publishes the bid, then drops the lot and sale tags", async () => {
    const t = setup();
    await t.sender.notifyBidPlaced(lot, bid);
    expect(t.inner.notifyBidPlaced).toHaveBeenCalledWith(lot, bid, undefined);
    expect(t.invalidator.invalidate).toHaveBeenCalledWith(LOT_TAGS);
  });

  it("drops the tags when a close time moves and when a lot ends", async () => {
    const t = setup();
    await t.sender.notifyLotExtended(lot, new Date());
    await t.sender.notifyLotEnded(lot, null);
    expect(t.invalidator.invalidate).toHaveBeenCalledTimes(2);
  });

  it("never fails bidding when the web app cannot be reached", async () => {
    const t = setup();
    t.invalidator.invalidate.mockRejectedValue(new Error("down"));
    await expect(t.sender.notifyBidPlaced(lot, bid)).resolves.toBeUndefined();
    await vi.waitFor(() => expect(t.onError).toHaveBeenCalled());
  });

  it("does not purge for a cancelled proxy, which no visitor sees", async () => {
    const t = setup();
    await t.sender.notifyProxyCancelled("lot-1", "user-1");
    expect(t.invalidator.invalidate).not.toHaveBeenCalled();
  });
});
