import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import { describe, expect, it } from "vitest";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import {
  fanoutOrganisationLimitChanged,
  fanoutSaleRegistrationDecided,
  fanoutSaleRegistrationLimitChanged,
} from "./bidding-registration-fanout.js";

const SALE_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const ENTITY_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const SAM = { email: "sam@example.com", name: "Sam Lee", firstName: "Sam" };

function harness(person: typeof SAM | null = SAM) {
  const sent: EmailEnqueueInput<TemplateName>[] = [];
  const emailService: IEmailService = {
    async enqueue(input) {
      sent.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a" };
    },
  };
  const notificationFanoutReader = {
    getUserForProxyNotice: async () => person,
    getSaleTitle: async () => "Autumn Sale",
    getEntityDisplayName: async () => "Northbank Gallery",
    listEntityRecipients: async () => [
      { email: "owner@example.com", userId: "owner", firstName: "Olu" },
      { email: "fin@example.com", userId: "fin", firstName: null },
    ],
  } as unknown as INotificationFanoutReader;
  return {
    sent,
    deps: { emailService, notificationFanoutReader, supportContactEmail: "help@lax.bid" },
  };
}

describe("fanoutSaleRegistrationDecided", () => {
  it("tells an approved bidder their limit and links to the sale", async () => {
    const { sent, deps } = harness();
    await fanoutSaleRegistrationDecided({
      ...deps,
      eventId: 7,
      webOrigin: "https://lax.bid",
      payload: { saleId: SALE_ID, userId: "sam", decision: "approved", bidLimit: "5000.00" },
    });
    expect(sent).toEqual([
      expect.objectContaining({
        template: "sale-registration-decision-notice",
        to: "sam@example.com",
        idempotencyKey: "sale-registration-decision:7:sam",
        vars: expect.objectContaining({
          decision: "approved",
          saleTitle: "Autumn Sale",
          bidLimit: "£5,000.00",
          reason: null,
          saleUrl: `https://lax.bid/sales/autumn-sale/${SALE_ID}`,
        }),
      }),
    ]);
  });

  it("passes the staff reason on a decline and drops any limit", async () => {
    const { sent, deps } = harness();
    await fanoutSaleRegistrationDecided({
      ...deps,
      eventId: 8,
      webOrigin: "https://lax.bid",
      payload: {
        saleId: SALE_ID,
        userId: "sam",
        decision: "declined",
        bidLimit: "5000.00",
        reason: "  Identity check incomplete. ",
      },
    });
    expect(sent[0]?.vars).toEqual(
      expect.objectContaining({
        decision: "declined",
        reason: "Identity check incomplete.",
        bidLimit: null,
      }),
    );
  });

  it("sends nothing when the person has no email on record", async () => {
    const { sent, deps } = harness(null);
    await fanoutSaleRegistrationDecided({
      ...deps,
      eventId: 9,
      webOrigin: "https://lax.bid",
      payload: { saleId: SALE_ID, userId: "sam", decision: "approved" },
    });
    expect(sent).toEqual([]);
  });
});

describe("fanoutSaleRegistrationLimitChanged", () => {
  it("shows the previous and new limit, and a removed limit as null", async () => {
    const { sent, deps } = harness();
    await fanoutSaleRegistrationLimitChanged({
      ...deps,
      eventId: 3,
      payload: { saleId: SALE_ID, userId: "sam", previousLimit: "1000.00", limit: null },
    });
    expect(sent[0]).toEqual(
      expect.objectContaining({
        template: "bidding-limit-changed-notice",
        idempotencyKey: "bidding-limit-changed:3:sam",
        vars: expect.objectContaining({
          scope: "sale",
          scopeName: "Autumn Sale",
          previousLimit: "£1,000.00",
          newLimit: null,
        }),
      }),
    );
  });
});

describe("fanoutOrganisationLimitChanged", () => {
  it("emails each owner, admin and finance member when staff change the limit", async () => {
    const { sent, deps } = harness();
    await fanoutOrganisationLimitChanged({
      ...deps,
      eventId: 4,
      legalEntityId: ENTITY_ID,
      payload: { previous_limit: null, limit: "20000.00", changed_by: "staff" },
    });
    expect(sent.map((email) => email.to)).toEqual(["owner@example.com", "fin@example.com"]);
    expect(sent[0]?.vars).toEqual(
      expect.objectContaining({
        scope: "organisation",
        scopeName: "Northbank Gallery",
        previousLimit: null,
        newLimit: "£20,000.00",
      }),
    );
  });

  it("stays quiet when a member made the change themselves", async () => {
    const { sent, deps } = harness();
    await fanoutOrganisationLimitChanged({
      ...deps,
      eventId: 5,
      legalEntityId: ENTITY_ID,
      payload: { previous_limit: null, limit: "20000.00", changed_by: "member" },
    });
    expect(sent).toEqual([]);
  });
});
