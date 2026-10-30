import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { PurchaseDeliveryStage } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { deliveryPanel } from "./purchase-delivery.vm";

function facts(
  stage: PurchaseDeliveryStage,
  overrides: Partial<AccountPurchaseFacts> = {},
): AccountPurchaseFacts {
  return {
    lotId: "lot-1",
    wonBy: null,
    paymentRole: "payer",
    invoice: { status: "paid", dueAt: null, paymentId: "p1", totalDue: "1875.00" },
    delivery: {
      stage,
      method: null,
      carrier: null,
      trackingNumber: null,
      collectedBy: null,
      collectedAt: null,
      quote: null,
    },
    ...overrides,
  };
}

const EMAIL_OFFER = {
  kind: "email" as const,
  email: "collections@lax.bid",
  hours: "Monday to Friday, 10:00 to 17:00",
  place: "22 Marylebone High Street, London W1U 4PF",
};

const panel = (f: AccountPurchaseFacts) =>
  deliveryPanel({
    facts: f,
    collection: EMAIL_OFFER,
    payerTeam: "Northbank Gallery's finance team",
  });

describe("deliveryPanel", () => {
  it("lets a payer choose how the work comes, and only tells anyone else", () => {
    expect(panel(facts("choose"))).toMatchObject({ kind: "choose", beforePayment: false });
    expect(panel(facts("awaiting_payment"))).toMatchObject({ kind: "choose", beforePayment: true });
    expect(panel(facts("choose", { paymentRole: "informed" }))).toEqual({
      kind: "told",
      line: "Northbank Gallery's finance team chooses how the work is delivered.",
    });
  });

  it("offers only the quote steps the server allows", () => {
    const quote = {
      id: "q1",
      status: "quoted" as const,
      destination: "14 Riverside Walk, London SE1 9PP",
      amount: "180.00",
      currency: "GBP",
      quoteNote: "Insured, 3 to 5 working days.",
      requestedAt: new Date("2026-10-28T10:00:00Z"),
      quotedAt: new Date("2026-10-29T10:00:00Z"),
      actions: ["accept" as const],
    };
    const ready = facts("quote_ready");
    ready.delivery.quote = quote;
    expect(panel(ready)).toMatchObject({
      kind: "quote-ready",
      amount: "£180.00",
      canAccept: true,
      canDecline: false,
    });
  });

  it("says where to collect and to email to book while self-serve booking is off", () => {
    expect(panel(facts("ready_to_collect"))).toMatchObject({
      kind: "collect",
      collection: { bookingEmail: "collections@lax.bid", place: EMAIL_OFFER.place },
    });
  });
});
