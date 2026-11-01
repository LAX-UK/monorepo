import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import type { IUserRepository } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import type { NotificationPayload } from "../services/interfaces/notification-channel.js";
import { EmailNotificationChannel } from "./email-notification.channel.js";

const USER_ID = "2f1c1a1e-7a0e-4c53-9d0b-6f1a2b3c4d5e";
const LOT_ID = "9b7d0a52-1f43-4b7a-8a55-0c2f6e1d3a90";
const BASE_URL = "https://test.lax.bid/";

function setup(billingEmail: string | null = null) {
  const enqueued: EmailEnqueueInput<TemplateName>[] = [];
  const email: IEmailService = {
    async enqueue(input) {
      enqueued.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "3c2b1a09-8d7e-4f6a-9b5c-4d3e2f1a0b9c" };
    },
  };
  const users = {
    async findById() {
      return { id: USER_ID, email: "ada@example.com", name: "Ada" };
    },
  } as unknown as IUserRepository;
  const channel = new EmailNotificationChannel(
    email,
    users,
    BASE_URL,
    "7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921",
    {
      find: async () =>
        billingEmail ? { billingEmail, address: null, poReference: null, updatedAt: null } : null,
    },
  );
  return { channel, enqueued };
}

function payload(overrides: Partial<NotificationPayload>): NotificationPayload {
  return {
    type: "payment_received",
    legalEntityId: null,
    title: "Payment received",
    message: 'Your payment for "Blue Vase" was recorded.',
    lotId: LOT_ID,
    meta: { lotTitle: "Blue Vase" },
    ...overrides,
  };
}

describe("EmailNotificationChannel outbid and won", () => {
  it("prints the formatted current bid, not the notification sentence", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({
        type: "outbid",
        message: 'Another bidder placed a higher bid on "Blue Vase".',
        meta: { lotTitle: "Blue Vase", bidAmount: "1000.00" },
      }),
    );
    expect(enqueued[0]?.template).toBe("bid-outbid");
    expect(enqueued[0]?.vars).toMatchObject({ currentBid: "£1,000.00" });
    expect(JSON.stringify(enqueued[0]?.vars)).not.toContain("higher bid");
  });

  it("leaves the amount out for an older outbid row that has no structured amount", async () => {
    const { channel, enqueued } = setup();
    await channel.send(USER_ID, payload({ type: "outbid", meta: { lotTitle: "Blue Vase" } }));
    expect(enqueued[0]?.vars).toMatchObject({ currentBid: null });
  });

  it("formats the won amounts and sends the buyer to checkout for that lot", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({
        type: "lot_won",
        message: 'You won "Blue Vase". Complete payment from your portfolio when ready.',
        meta: {
          lotTitle: "Blue Vase",
          bidAmount: "1000.00",
          hammerPrice: "1000.00",
          totalDue: "1250.00",
        },
      }),
    );
    expect(enqueued[0]?.template).toBe("lot-won");
    expect(enqueued[0]?.vars).toMatchObject({
      winningBid: "£1,000.00",
      hammerPrice: "£1,000.00",
      totalDue: "£1,250.00",
      paymentUrl: `https://test.lax.bid/purchases/checkout/${LOT_ID}`,
    });
    expect(JSON.stringify(enqueued[0]?.vars)).not.toContain("portfolio");
  });
});

describe("EmailNotificationChannel lot ended for the seller", () => {
  it("renders a sold notice with the formatted hammer price and a link to consignments", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({
        type: "lot_ended_seller",
        meta: { lotTitle: "Blue Vase", outcome: "sold", hammerPrice: "1000.00" },
      }),
    );
    expect(enqueued[0]?.template).toBe("lot-ended-seller");
    expect(enqueued[0]?.vars).toMatchObject({
      outcome: "sold",
      hammerPrice: "£1,000.00",
      saleUrl: "https://test.lax.bid/selling/consignments",
    });
  });

  it("renders an unsold notice without a price", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({ type: "lot_ended_seller", meta: { lotTitle: "Blue Vase", outcome: "unsold" } }),
    );
    expect(enqueued[0]?.vars).toMatchObject({ outcome: "unsold", hammerPrice: null });
  });
});

describe("EmailNotificationChannel payment receipt", () => {
  it("formats the amount from structured metadata and links to the buyer's purchases", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({ meta: { lotTitle: "Blue Vase", audience: "buyer", amount: "1250.00" } }),
    );
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.template).toBe("payment-receipt");
    expect(enqueued[0]?.vars).toMatchObject({
      lotTitle: "Blue Vase",
      amount: "£1,250.00",
      receiptUrl: "https://test.lax.bid/purchases",
    });
  });

  it("never prints the notification sentence as the amount", async () => {
    const { channel, enqueued } = setup();
    await channel.send(USER_ID, payload({ meta: { lotTitle: "Blue Vase", audience: "buyer" } }));
    expect(enqueued[0]?.vars).toMatchObject({ amount: null });
    expect(JSON.stringify(enqueued[0]?.vars)).not.toContain("was recorded");
  });

  it("does not send the buyer's receipt to the seller's recipients", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({
        message: 'Payment of 1250.00 was recorded for "Blue Vase".',
        meta: { lotTitle: "Blue Vase", audience: "seller", amount: "1250.00" },
      }),
    );
    expect(enqueued).toHaveLength(0);
  });
});

describe("EmailNotificationChannel lot fulfilment", () => {
  it("sends the fulfilment update with the notice's own words, keyed once per step", async () => {
    const { channel, enqueued } = setup();
    await channel.send(
      USER_ID,
      payload({
        type: "lot_shipped",
        title: "Your lot is on its way",
        message: '"Blue Vase" has been sent with DHL. Tracking number: 123.',
        meta: { lotTitle: "Blue Vase", emailIdempotencyKey: "lot-fulfilment:lot-1:lot_shipped" },
      }),
    );
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      template: "lot-fulfilment-update",
      category: "transactional",
      idempotencyKey: "lot-fulfilment:lot-1:lot_shipped",
      vars: {
        lotTitle: "Blue Vase",
        heading: "Your lot is on its way",
        message: '"Blue Vase" has been sent with DHL. Tracking number: 123.',
        purchaseUrl: "https://test.lax.bid/purchases",
      },
    });
  });
});

const ORG_ID = "5d4c3b2a-1908-4f7e-8d6c-5b4a39281706";

function invoice(legalEntityId: string | null): NotificationPayload {
  return {
    type: "payment_due",
    legalEntityId,
    title: "Payment due",
    message: "GBP 1,250.00",
    lotId: LOT_ID,
    meta: { paymentId: "pay-1", amount: "GBP 1,250.00", invoiceNumber: "INV-0001" },
  };
}

describe("EmailNotificationChannel invoices to the billing email", () => {
  it("sends the member their invoice and a copy to the organisation's billing email", async () => {
    const { channel, enqueued } = setup("accounts@northbank.example");
    await channel.send(USER_ID, invoice(ORG_ID));
    expect(enqueued.map((e) => [e.template, e.to])).toEqual([
      ["payment-invoice", "ada@example.com"],
      ["payment-invoice", "accounts@northbank.example"],
    ]);
    expect(enqueued[1]).toMatchObject({
      recipientResolution: "snapshot",
      idempotencyKey: `payment-invoice-billing:${ORG_ID}:pay-1`,
      vars: { invoiceNumber: "INV-0001" },
    });
    expect(enqueued[1]?.userId).toBeUndefined();
  });

  it("sends one copy when the billing email is the member's own", async () => {
    const { channel, enqueued } = setup("ADA@example.com");
    await channel.send(USER_ID, invoice(ORG_ID));
    expect(enqueued).toHaveLength(1);
  });

  it("sends only the member's copy with no billing email or no organisation", async () => {
    const none = setup(null);
    await none.channel.send(USER_ID, invoice(ORG_ID));
    expect(none.enqueued).toHaveLength(1);
    const personal = setup("accounts@northbank.example");
    await personal.channel.send(USER_ID, invoice(null));
    expect(personal.enqueued).toHaveLength(1);
  });
});

describe("EmailNotificationChannel watched-lot reminder", () => {
  it("prints the person's note and the close, with an unsubscribe for this switch only", async () => {
    const { channel, enqueued } = setup();
    await channel.send(USER_ID, {
      type: "watchlist_reminder",
      legalEntityId: null,
      title: 'Reminder: "Blue Vase"',
      message: "It closes in about an hour.",
      lotId: LOT_ID,
      meta: {
        lotTitle: "Blue Vase",
        watchedLotReminder: {
          kind: "hour_before_close",
          note: "Check the glaze",
          closesAt: "2026-11-26T18:00:00.000Z",
        },
      },
    });
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      template: "watched-lot-reminder",
      to: "ada@example.com",
      vars: {
        lotTitle: "Blue Vase",
        kind: "hour_before_close",
        note: "Check the glaze",
        closesAt: "26 Nov 2026, 18:00",
      },
    });
    const url = new URL((enqueued[0]?.vars as { unsubscribeUrl: string }).unsubscribeUrl);
    const body = JSON.parse(
      Buffer.from(url.searchParams.get("t")?.split(".")[0] ?? "", "base64url").toString(),
    );
    expect(body).toMatchObject({ scope: "type", notificationType: "watchlist_reminder" });
  });
});

describe("EmailNotificationChannel payout bank change", () => {
  it("names the organisation and the new account, and links to payouts", async () => {
    const { channel, enqueued } = setup();
    await channel.send(USER_ID, {
      type: "payout_bank_changed",
      legalEntityId: ORG_ID,
      title: "The payout bank account for Northbank Gallery changed",
      message: "Payouts now go to the account ending 4242.",
      meta: { organisationName: "Northbank Gallery", bankLast4: "4242" },
    });
    expect(enqueued).toEqual([
      expect.objectContaining({
        template: "payout-bank-changed-notice",
        to: "ada@example.com",
        vars: {
          userName: "Ada",
          entityName: "Northbank Gallery",
          bankLast4: "4242",
          payoutsUrl: "https://test.lax.bid/organisation/payouts",
        },
      }),
    ]);
  });
});
