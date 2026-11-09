import { type EmailEnqueueInput, type TemplateName, renderEmail } from "@auction/email";
import type { DealReminderCandidate } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { EmailNotificationChannel } from "../../infrastructure/email-notification.channel.js";
import type { NotificationPayload } from "../interfaces/notification-channel.js";
import { NotificationFactory } from "../notification.factory.js";
import { DealReminderService } from "./deal-reminder.service.js";

const dueDay = new Date("2026-11-20T09:00:00Z");

const candidate: DealReminderCandidate = {
  dealId: "deal-1",
  reference: "PS-0012",
  stage: "invoiced",
  kind: "payment",
  dueAt: new Date("2026-11-20T23:59:59.999Z"),
  buyerLegalEntityId: "le-buyer",
  buyerUserId: "u-buyer",
  workTitle: "Harbour at dusk",
  amountDueMinor: 4_800_000,
  sentSteps: [],
};

/** Sends the deal's payment reminder through the real factory and email channel, and renders it. */
async function renderedReminder() {
  const payloads: NotificationPayload[] = [];
  const service = new DealReminderService({
    store: {
      listCandidates: async () => [candidate],
      claim: async () => true,
      release: async () => undefined,
    },
    compliance: null,
    outbox: {
      stageDispatch: vi.fn(async (input: { payload: NotificationPayload }) => {
        payloads.push(input.payload);
      }) as never,
    },
    factory: new NotificationFactory(),
    recipients: { forInvoice: async () => ["u-buyer"] } as never,
    now: () => dueDay,
  });
  await service.sendDueReminders();

  const enqueued: EmailEnqueueInput<TemplateName>[] = [];
  const channel = new EmailNotificationChannel(
    {
      async enqueue(input) {
        enqueued.push(input as EmailEnqueueInput<TemplateName>);
        return { outboxId: "3c2b1a09-8d7e-4f6a-9b5c-4d3e2f1a0b9c" };
      },
    },
    { findById: async () => ({ id: "u-buyer", email: "ada@example.com", name: "Ada" }) } as never,
    "https://test.lax.bid/",
    "7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921",
    { find: async () => null },
  );
  await channel.send("u-buyer", payloads[0] as NotificationPayload);
  const [message] = enqueued;
  const email = await renderEmail(message?.template as "payment-reminder", message?.vars as never);
  return { message, email };
}

describe("a private sale deal's payment reminder", () => {
  it("reaches the buyer's email as a payment reminder that calls the item a work", async () => {
    const { message } = await renderedReminder();
    expect(message?.template).toBe("payment-reminder");
    expect(message?.vars).toMatchObject({ itemLabel: "Work", lotTitle: "Harbour at dusk" });
  });

  it("renders the card as Work, never Lot", async () => {
    const { email } = await renderedReminder();
    expect(email.html).toMatch(/>Work</);
    expect(email.html).not.toMatch(/>Lot</);
    expect(email.text).toContain("Harbour at dusk");
    expect(email.text).toContain("£48,000.00");
  });
});
