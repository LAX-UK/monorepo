import type { Database } from "@auction/db";
import type { LotReofferView, StageNotificationOutboxInput } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { OutboxReofferNotices } from "./reoffer-outbox-notices.js";

const tx = {} as Database;
const offer = {
  id: "offer-1",
  amountPence: 90_000,
  offeredUserId: "bidder-1",
  offeredLegalEntityId: "bidder-entity",
} as LotReofferView;
const subject = {
  offer,
  lot: { id: "lot-1", title: "The Winter Study", lotNumber: 12 },
  at: new Date("2026-11-05T17:00:00Z"),
  now: new Date("2026-11-04T18:00:00Z"),
};

function setup(staged = true) {
  const stage = vi.fn(async (_input: StageNotificationOutboxInput, _tx?: Database) => staged);
  const people = {
    accountRecipients: vi.fn(async () => [
      { userId: "owner-1", email: "o1@example.com", firstName: null },
      { userId: "owner-2", email: "o2@example.com", firstName: null },
    ]),
  };
  return { stage, people, notices: new OutboxReofferNotices({ stage }, people) };
}

describe("OutboxReofferNotices", () => {
  it("reminds every owner of the seller's account once, keyed to the offer and the person", async () => {
    const { stage, people, notices } = setup();
    expect(await notices.sellerReminder(tx, subject, "seller-entity")).toBe(2);
    expect(people.accountRecipients).toHaveBeenCalledWith("seller-entity");
    expect(stage.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      "reoffer_seller_reminder:offer-1:owner-1",
      "reoffer_seller_reminder:offer-1:owner-2",
    ]);
    expect(stage.mock.calls[0]?.[0]).toMatchObject({
      userId: "owner-1",
      payload: {
        type: "reoffer_seller_reminder",
        title: "Your answer is needed by Thu 5 Nov, 17:00 GMT: The Winter Study",
        message: expect.stringContaining("we won't offer it"),
        lotId: "lot-1",
        legalEntityId: "seller-entity",
      },
    });
    // Staged in the step's own transaction.
    expect(stage.mock.calls[0]?.[1]).toBe(tx);
  });

  it("reminds the offered bidder, with the amount, on the bidder's account", async () => {
    const { stage, notices } = setup();
    expect(await notices.offerReminder(tx, subject)).toBe(1);
    expect(stage.mock.calls[0]?.[0]).toMatchObject({
      userId: "bidder-1",
      idempotencyKey: "reoffer_offer_reminder:offer-1:bidder-1",
      payload: {
        type: "reoffer_offer_reminder",
        title: "Your offer for The Winter Study ends tomorrow",
        message: expect.stringMatching(/at £900\.00 ends on Thu 5 Nov, 17:00 GMT/),
        legalEntityId: "bidder-entity",
      },
    });
  });

  it("counts only the notices that were new", async () => {
    const { notices } = setup(false);
    expect(await notices.offerReminder(tx, subject)).toBe(0);
  });

  it("tells the bidder an offer ended, and the seller only when they agreed to it", async () => {
    const agreed = setup();
    await agreed.notices.offerEnded(tx, subject, { legalEntityId: "seller-entity", agreed: true });
    expect(agreed.stage.mock.calls.map(([input]) => input.payload.type)).toEqual([
      "reoffer_offer_closed",
      "reoffer_seller_outcome",
      "reoffer_seller_outcome",
    ]);

    const notAgreed = setup();
    await notAgreed.notices.offerEnded(tx, subject, {
      legalEntityId: "seller-entity",
      agreed: false,
    });
    expect(notAgreed.stage).toHaveBeenCalledTimes(1);

    const houseStock = setup();
    await houseStock.notices.offerEnded(tx, subject, null);
    expect(houseStock.stage).toHaveBeenCalledTimes(1);
    expect(houseStock.people.accountRecipients).not.toHaveBeenCalled();
  });

  it("never names a person or an address in a notice", async () => {
    const { stage, notices } = setup();
    await notices.offerEnded(tx, subject, { legalEntityId: "seller-entity", agreed: true });
    const text = JSON.stringify(stage.mock.calls.map(([input]) => input));
    expect(text).not.toContain("example.com");
  });
});
