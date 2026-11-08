import type { BidPaymentGroupFact } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import {
  BUYING_ACCOUNT,
  InMemoryPurchaseFacts,
  LOTS,
  NOW,
  seedPurchases,
} from "../../testing/in-memory-workspace-buying.js";
import { StillToSendService } from "../payment-group/still-to-send.service.js";
import { AccountPurchasesService } from "./account-purchases.service.js";

const owner = { userId: "owner-1", legalEntityId: BUYING_ACCOUNT, role: "owner" as const };

/** Two invoices (600.10 and 400.00) both on their way inside one combined payment. */
function purchases() {
  return seedPurchases().map((row) =>
    row.payment && (row.lotId === LOTS.due || row.lotId === LOTS.overdue)
      ? { ...row, payment: { ...row.payment, status: "authorized" as const } }
      : row,
  );
}

function listWith(group: Partial<BidPaymentGroupFact> | null) {
  const facts: BidPaymentGroupFact = {
    id: "group-1",
    status: "processing",
    checkoutRail: "gb_bank_transfer",
    totalAmount: "1000.10",
    amountReceived: "500.05",
    ...group,
  };
  const service = new AccountPurchasesService({
    reader: new InMemoryPurchaseFacts(purchases()),
    stillToSend: new StillToSendService({
      processingForPayments: async (ids) =>
        new Map(
          group === null
            ? []
            : ids.filter((id) => ["pay-2", "pay-3"].includes(id)).map((id) => [id, facts] as const),
        ),
    }),
    now: () => NOW,
  });
  return service
    .list(owner, { limit: 50, offset: 0 })
    .then((result) => new Map(result._unsafeUnwrap().items.map((item) => [item.lotId, item])));
}

describe("a purchase inside a part-funded bank transfer", () => {
  it("carries its share of what is still to send, still being confirmed as an invoice", async () => {
    const byLot = await listWith({});
    expect(byLot.get(LOTS.due)?.invoice).toMatchObject({
      status: "processing",
      stillToSendPence: 30_005,
    });
    expect(byLot.get(LOTS.overdue)?.invoice.stillToSendPence).toBe(20_000);
    // The shares add up to what is left: 1000.10 asked, 500.05 received.
    expect(30_005 + 20_000).toBe(50_005);
  });

  it("leaves other invoices alone", async () => {
    const byLot = await listWith({});
    expect(byLot.get(LOTS.paid)?.invoice.stillToSendPence).toBeNull();
    expect(byLot.get(LOTS.agentWin)?.invoice.stillToSendPence).toBeNull();
  });

  it("owes nothing once the transfer is fully funded", async () => {
    const byLot = await listWith({ amountReceived: "1000.10" });
    expect(byLot.get(LOTS.due)?.invoice.stillToSendPence).toBeNull();
    expect(byLot.get(LOTS.overdue)?.invoice.stillToSendPence).toBeNull();
  });

  it("is only being confirmed while nothing has arrived yet", async () => {
    const byLot = await listWith({ amountReceived: "0.00" });
    expect(byLot.get(LOTS.due)?.invoice).toMatchObject({
      status: "processing",
      stillToSendPence: null,
    });
  });

  it("is not part-funded when the combined payment is by card", async () => {
    const byLot = await listWith({ checkoutRail: "card" });
    expect(byLot.get(LOTS.due)?.invoice.stillToSendPence).toBeNull();
  });

  it("is not part-funded when the invoice is paid on its own", async () => {
    const byLot = await listWith(null);
    expect(byLot.get(LOTS.due)?.invoice.stillToSendPence).toBeNull();
  });
});
