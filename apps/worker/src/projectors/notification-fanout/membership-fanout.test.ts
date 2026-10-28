import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import { describe, expect, it } from "vitest";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import { fanoutMemberRemoved } from "./membership-fanout.js";

const ENTITY_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const LOT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function harness(member: { email: string; name: string; firstName: string | null } | null) {
  const sent: EmailEnqueueInput<TemplateName>[] = [];
  const emailService: IEmailService = {
    async enqueue(input) {
      sent.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a" };
    },
  };
  const notificationFanoutReader = {
    getUserForProxyNotice: async () => member,
    getEntityDisplayName: async () => "Northbank Gallery",
    getLotTitle: async () => "Harbour at Dusk",
  } as unknown as INotificationFanoutReader;
  return {
    sent,
    deps: { emailService, notificationFanoutReader, supportContactEmail: "help@lax.bid" },
  };
}

const SAM = { email: "sam@example.com", name: "Sam Lee", firstName: "Sam" };

describe("fanoutMemberRemoved", () => {
  it("emails the removed person once, linking back to their own account", async () => {
    const { sent, deps } = harness(SAM);
    await fanoutMemberRemoved({
      ...deps,
      eventId: 11,
      legalEntityId: ENTITY_ID,
      webOrigin: "https://lax.bid",
      payload: { member_user_id: "sam", removed_by_user_id: "owner", role_at_removal: "consignor" },
    });
    expect(sent).toEqual([
      expect.objectContaining({
        template: "organisation-membership-ended-notice",
        to: "sam@example.com",
        idempotencyKey: "organisation-membership-ended:11:sam",
        vars: expect.objectContaining({
          entityName: "Northbank Gallery",
          bidUrl: "https://lax.bid/home",
          recipientFirstName: "Sam",
        }),
      }),
    ]);
  });

  it("sends nothing when the person has no email on record", async () => {
    const { sent, deps } = harness(null);
    await fanoutMemberRemoved({
      ...deps,
      eventId: 12,
      legalEntityId: ENTITY_ID,
      webOrigin: "https://lax.bid",
      payload: { member_user_id: "sam", removed_by_user_id: "owner", role_at_removal: "viewer" },
    });
    expect(sent).toEqual([]);
  });
});

describe("fanoutMemberRemoved with stopped bids", () => {
  it("lists the automatic bids that stopped with the removal", async () => {
    const { sent, deps } = harness(SAM);
    await fanoutMemberRemoved({
      ...deps,
      eventId: 21,
      legalEntityId: ENTITY_ID,
      webOrigin: "https://lax.bid",
      payload: {
        member_user_id: "sam",
        removed_by_user_id: "owner",
        role_at_removal: "buyer_agent",
        stopped_bids: [{ kind: "auto_bid", lot_id: LOT_ID }, { kind: "nonsense" }],
      },
    });
    expect(sent[0]?.vars).toMatchObject({
      stoppedBids: [{ kind: "auto_bid", lotTitle: "Harbour at Dusk" }],
    });
  });
});
