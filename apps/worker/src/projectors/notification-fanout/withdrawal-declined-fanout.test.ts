import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import { describe, expect, it } from "vitest";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import { fanoutLotWithdrawalDeclined } from "./withdrawal-declined-fanout.js";

const ENTITY_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const LOT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function harness(lotTitle: string | null) {
  const sent: EmailEnqueueInput<TemplateName>[] = [];
  const emailService: IEmailService = {
    async enqueue(input) {
      sent.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a" };
    },
  };
  const notificationFanoutReader = {
    async getLotTitle() {
      return lotTitle;
    },
    async listEntityRecipients() {
      return [
        { userId: "user-a", email: "a@example.com", firstName: "Ana" },
        { userId: "user-b", email: "b@example.com", firstName: null },
      ];
    },
  } as unknown as INotificationFanoutReader;
  return { sent, emailService, notificationFanoutReader };
}

describe("fanoutLotWithdrawalDeclined", () => {
  it("emails every seller organisation member the reason, once per event", async () => {
    const { sent, emailService, notificationFanoutReader } = harness("Harbour at Dusk");
    await fanoutLotWithdrawalDeclined({
      notificationFanoutReader,
      emailService,
      supportContactEmail: "support@lax.bid",
      eventId: 7,
      lotId: LOT_ID,
      payload: { sellerLegalEntityId: ENTITY_ID, reason: "Already in the catalogue" },
    });
    expect(sent.map((m) => m.to)).toEqual(["a@example.com", "b@example.com"]);
    expect(sent[0]).toMatchObject({
      template: "lot-withdrawal-declined-notice",
      idempotencyKey: "lot-withdrawal-declined-notice:7:seller:user-a",
      vars: { lotTitle: "Harbour at Dusk", reason: "Already in the catalogue" },
    });
  });

  it("sends nothing when the lot no longer exists", async () => {
    const { sent, emailService, notificationFanoutReader } = harness(null);
    await fanoutLotWithdrawalDeclined({
      notificationFanoutReader,
      emailService,
      supportContactEmail: "support@lax.bid",
      eventId: 8,
      lotId: LOT_ID,
      payload: { sellerLegalEntityId: ENTITY_ID, reason: "x" },
    });
    expect(sent).toEqual([]);
  });
});
