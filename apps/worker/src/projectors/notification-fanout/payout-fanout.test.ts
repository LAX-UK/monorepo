import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import { describe, expect, it } from "vitest";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { IStaffOpsRecipientReader } from "../../interfaces/staff-ops-recipient.reader.js";
import { fanoutPayoutClawbackRequired } from "./clawback-fanout.js";
import { sellerPayoutsUrlFor } from "./notification-fanout-helpers.js";
import { fanoutPayoutInitiated } from "./payout-fanout.js";
import { fanoutPayoutTransferBlocked } from "./transfer-blocked-fanout.js";

const ENTITY_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const PAYOUT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const SELLER_USER = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2918";
const STAFF_USER = "2b3c4d5e-6f70-4a81-92a3-b4c5d6e7f809";
const ADMIN_URL = "https://test.lax.bid/admin/payouts";
const SELLER_URL = "https://test.lax.bid/selling/payouts";

function harness() {
  const sent: EmailEnqueueInput<TemplateName>[] = [];
  const emailService: IEmailService = {
    async enqueue(input) {
      sent.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a" };
    },
  };
  const notificationFanoutReader = {
    async getEntityDisplayName() {
      return "Acme Ltd";
    },
    async listEntityRecipients() {
      return [{ userId: SELLER_USER, email: "seller@example.com", firstName: "Sam" }];
    },
    async getPayoutAmounts() {
      return { netAmount: "100.00", currency: "GBP" };
    },
  } as unknown as INotificationFanoutReader;
  const staffOpsRecipientReader: IStaffOpsRecipientReader = {
    async listRecipients() {
      return [{ id: STAFF_USER, email: "ops@example.com", firstName: "Olu" }];
    },
  };
  return { sent, emailService, notificationFanoutReader, staffOpsRecipientReader };
}

describe("sellerPayoutsUrlFor", () => {
  it("points at Sold & payouts on the same origin as the admin queue", () => {
    expect(sellerPayoutsUrlFor(ADMIN_URL)).toBe(SELLER_URL);
  });
});

describe("seller payout notices", () => {
  it("sends the initiated notice to Sold & payouts, not the admin queue", async () => {
    const h = harness();
    await fanoutPayoutInitiated({
      notificationFanoutReader: h.notificationFanoutReader,
      emailService: h.emailService,
      adminPayoutsUrl: ADMIN_URL,
      eventId: 1,
      payoutId: PAYOUT_ID,
      payload: { legalEntityId: ENTITY_ID, amountCents: 10000, currency: "GBP" },
    });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]?.vars).toMatchObject({ payoutsUrl: SELLER_URL });
    expect(JSON.stringify(h.sent[0]?.vars)).not.toContain("/admin/");
  });

  it("sends the blocked notice to the seller, and a separate staff alert to ops", async () => {
    const h = harness();
    await fanoutPayoutTransferBlocked({
      notificationFanoutReader: h.notificationFanoutReader,
      staffOpsRecipientReader: h.staffOpsRecipientReader,
      emailService: h.emailService,
      supportContactEmail: "support@lax.bid",
      adminPayoutsUrl: ADMIN_URL,
      eventId: 2,
      payoutId: PAYOUT_ID,
      payload: { payoutId: PAYOUT_ID, legalEntityId: ENTITY_ID, reason: "connect_not_ready" },
    });
    const seller = h.sent.find((e) => e.to === "seller@example.com");
    const staff = h.sent.find((e) => e.to === "ops@example.com");
    expect(seller?.vars).toMatchObject({ audience: "seller", payoutsUrl: SELLER_URL });
    expect(staff?.vars).toMatchObject({ audience: "staff", payoutsUrl: ADMIN_URL });
    expect(seller?.idempotencyKey).not.toBe(staff?.idempotencyKey);
  });

  it("sends the clawback notice to the seller on their page and to staff on the admin queue", async () => {
    const h = harness();
    await fanoutPayoutClawbackRequired({
      notificationFanoutReader: h.notificationFanoutReader,
      staffOpsRecipientReader: h.staffOpsRecipientReader,
      emailService: h.emailService,
      adminPayoutsUrl: ADMIN_URL,
      eventId: 3,
      payoutId: PAYOUT_ID,
      payload: { legalEntityId: ENTITY_ID, netAmount: "-5.00", currency: "GBP" },
    });
    expect(h.sent.find((e) => e.to === "seller@example.com")?.vars).toMatchObject({
      audience: "seller",
      payoutsUrl: SELLER_URL,
    });
    expect(h.sent.find((e) => e.to === "ops@example.com")?.vars).toMatchObject({
      audience: "staff",
      payoutsUrl: ADMIN_URL,
    });
  });
});
