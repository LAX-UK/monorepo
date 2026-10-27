import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { processPayoutTransferFailedNotify } from "./payout-transfer-failed-notify.js";

const ENTITY_ID = "5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a";
const PAYOUT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const FINANCE_USER = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2918";
const STAFF_USER = "2b3c4d5e-6f70-4a81-92a3-b4c5d6e7f809";

describe("processPayoutTransferFailedNotify", () => {
  it("tells the seller in seller wording and alerts staff separately", async () => {
    const sent: EmailEnqueueInput<TemplateName>[] = [];
    const emailService: IEmailService = {
      async enqueue(input) {
        sent.push(input as EmailEnqueueInput<TemplateName>);
        return { outboxId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a" };
      },
    };
    const advanceCursor = vi.fn(async () => undefined);
    const ctx = {
      webOrigin: "https://test.lax.bid",
      adminEmailAddress: undefined,
      projectorStateRepo: { getCursor: async () => 0, advanceCursor },
      domainEventReader: {
        listAfterCursor: async () => [
          {
            id: 7,
            aggregateId: PAYOUT_ID,
            payload: {
              legalEntityId: ENTITY_ID,
              stripeErrorCode: "account_closed",
              stripeErrorMessage: "The bank account is closed",
              amountCents: 10000,
              currency: "GBP",
            },
          },
        ],
      },
      payoutTransferFailedNotifyReader: {
        getTransferFailedContext: async () => ({
          entityKind: "organisation",
          entityName: "Acme Ltd",
          payoutAmount: "100.00",
          payoutCurrency: "GBP",
          financeMembers: [
            { userId: FINANCE_USER, email: "finance@example.com", firstName: "Fin" },
          ],
        }),
      },
      staffOpsRecipientReader: {
        listRecipients: async () => [
          { id: STAFF_USER, email: "ops@example.com", firstName: "Olu" },
        ],
      },
    } as unknown as ProjectorRunContext;

    await processPayoutTransferFailedNotify({
      ctx,
      log: { warn: vi.fn(), error: vi.fn() } as never,
      emailService,
      supportContactEmail: "support@lax.bid",
      adminPayoutsUrl: "https://test.lax.bid/admin/payouts",
    });

    const seller = sent.find((e) => e.to === "finance@example.com");
    const staff = sent.find((e) => e.to === "ops@example.com");
    expect(seller?.vars).toMatchObject({
      audience: "seller",
      payoutsUrl: "https://test.lax.bid/selling/payouts",
      sellerPayoutSetupUrl: `https://test.lax.bid/organisation/payouts?account=${ENTITY_ID}`,
    });
    expect(staff?.vars).toMatchObject({
      audience: "staff",
      payoutsUrl: "https://test.lax.bid/admin/payouts",
      failureReason: "account_closed: The bank account is closed",
    });
    expect(advanceCursor).toHaveBeenCalledWith("payout_transfer_failed_notify", 7);
  });
});
