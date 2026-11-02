import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { EntityWonLot } from "@/lib/data/http/payments.schema";
import { describe, expect, it } from "vitest";
import { ownedWins } from "./collection-works";

const win = (lotId: string) => ({ lotId, title: lotId }) as unknown as EntityWonLot;

function purchase(
  lotId: string,
  invoice: AccountPurchaseFacts["invoice"]["status"],
  stage: AccountPurchaseFacts["delivery"]["stage"],
): AccountPurchaseFacts {
  return {
    lotId,
    invoice: { status: invoice, dueAt: null, paymentId: null, totalDue: null },
    delivery: { stage },
  } as unknown as AccountPurchaseFacts;
}

describe("ownedWins", () => {
  const facts = new Map(
    [
      purchase("paid", "paid", "choose"),
      purchase("collected", "paid", "collected"),
      purchase("unpaid", "due", "awaiting_payment"),
      purchase("cancelled", "cancelled", "cancelled"),
      purchase("refunded", "refunded", "cancelled"),
      purchase("paid-then-cancelled", "paid", "cancelled"),
    ].map((row) => [row.lotId, row]),
  );

  it("keeps the works paid for and drops unpaid, cancelled and refunded purchases", () => {
    const wins = [
      "paid",
      "collected",
      "unpaid",
      "cancelled",
      "refunded",
      "paid-then-cancelled",
      "unknown",
    ].map(win);
    expect(ownedWins(wins, facts).map((w) => w.lotId)).toEqual(["paid", "collected"]);
  });
});
