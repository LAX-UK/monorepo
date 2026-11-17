import { inspect } from "node:util";
import type { DeliveryQuoteRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationFactory } from "../notification.factory.js";
import { DeliveryQuoteNotifier } from "./delivery-quote-notifier.js";

const LOT = { id: "lot-1", title: "Harbour at dusk" } as Lot;
const REASON = "We don't ship to this region.";

const quote = (over: Partial<DeliveryQuoteRow> = {}): DeliveryQuoteRow => ({
  id: "quote-1",
  lotId: LOT.id,
  buyerLegalEntityId: "entity-1",
  status: "withdrawn",
  destination: "12 Rue Exemple, Lyon",
  amount: null,
  currency: "GBP",
  quoteNote: null,
  requestedByUserId: "buyer-1",
  requestedAt: new Date("2026-11-14T10:00:00Z"),
  quotedAt: null,
  decidedByUserId: "staff-1",
  decidedAt: new Date("2026-11-15T10:00:00Z"),
  declineReason: REASON,
  ...over,
});

function build(lot: Lot | null = LOT) {
  const dispatcher = { dispatch: vi.fn(async () => {}) };
  const lots = { findById: vi.fn(async () => lot) };
  const notifier = new DeliveryQuoteNotifier(
    lots as never,
    dispatcher,
    new NotificationFactory() as never,
  );
  return { notifier, dispatcher };
}

afterEach(() => vi.restoreAllMocks());

describe("DeliveryQuoteNotifier.quoteDeclined", () => {
  it("tells the member who asked, with the team's reason, once per quote", async () => {
    const { notifier, dispatcher } = build();
    await notifier.quoteDeclined(quote());
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [recipient, payload] = dispatcher.dispatch.mock.calls[0] as unknown as [
      string,
      { type: string; title: string; message: string; legalEntityId: string; meta: object },
    ];
    expect(recipient).toBe("buyer-1");
    expect(payload).toMatchObject({
      type: "delivery_quote_declined",
      title: "We can't deliver this lot",
      legalEntityId: "entity-1",
      meta: {
        lotTitle: "Harbour at dusk",
        outboxIdempotencyKey: "delivery-quote-declined:quote-1",
        emailIdempotencyKey: "delivery-quote-declined:quote-1",
      },
    });
    expect(payload.message).toContain(REASON);
    expect(payload.message).toContain("Harbour at dusk");
  });

  it("sends nothing for a quote with no reason, nobody to tell, or no lot", async () => {
    for (const [over, lot] of [
      [{ declineReason: null }, LOT],
      [{ requestedByUserId: null }, LOT],
      [{}, null],
    ] as const) {
      const { notifier, dispatcher } = build(lot);
      await notifier.quoteDeclined(quote(over));
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    }
  });

  it("never fails the decline, and logs ids only when the notice fails", async () => {
    const { notifier, dispatcher } = build();
    dispatcher.dispatch.mockRejectedValue(new Error(`smtp refused: ${REASON} 12 Rue Exemple`));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notifier.quoteDeclined(quote())).resolves.toBeUndefined();
    const logged = inspect(log.mock.calls, { depth: 5 });
    expect(logged).toContain("quote-1");
    expect(logged).not.toContain(REASON);
    expect(logged).not.toContain("Rue Exemple");
  });
});

describe("DeliveryQuoteNotifier.quoteReady", () => {
  it("keys a priced quote by its price, so a new price is a new notice", async () => {
    const { notifier, dispatcher } = build();
    await notifier.quoteReady(quote({ status: "quoted", amount: "180.00", declineReason: null }));
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "buyer-1",
      expect.objectContaining({
        type: "delivery_quote_ready",
        meta: expect.objectContaining({ emailIdempotencyKey: "delivery-quote:quote-1:180.00" }),
      }),
    );
  });
});
