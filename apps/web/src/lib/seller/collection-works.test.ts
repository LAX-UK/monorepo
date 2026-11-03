import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { EntityWonLot } from "@/lib/data/http/payments.schema";
import { describe, expect, it } from "vitest";
import {
  appliedWorksFilters,
  consignAvailability,
  ownedWins,
  parseWorksListQuery,
  worksListSearch,
} from "./collection-works";

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

describe("consignAvailability", () => {
  const paid = { invoice: "paid", deliveryStage: "choose" } as const;

  it("offers a paid work to a member who may sell", () => {
    expect(consignAvailability({ canSell: true, purchase: paid })).toEqual({
      canConsign: true,
      note: null,
    });
  });

  it("holds an unpaid work and says when it can be consigned", () => {
    expect(
      consignAvailability({
        canSell: true,
        purchase: { invoice: "due", deliveryStage: "awaiting_payment" },
      }),
    ).toEqual({ canConsign: false, note: "You can consign it once it's paid." });
  });

  it("says nothing to a member who may not sell", () => {
    expect(consignAvailability({ canSell: false, purchase: paid })).toEqual({
      canConsign: false,
      note: null,
    });
  });
});

describe("the works list query", () => {
  it("round-trips the place filter through the address and ignores unknown places", () => {
    const query = parseWorksListQuery({ where: "delivered", sort: "title" });
    expect(query).toEqual({ q: "", where: "delivered", sort: "title" });
    expect(worksListSearch(query)).toBe("?where=delivered&sort=title");
    expect(parseWorksListQuery({ where: "lost" }).where).toBeNull();
  });

  it("names the applied filter", () => {
    const query = parseWorksListQuery({ where: "with-us" });
    expect(appliedWorksFilters(query)).toEqual([{ id: "where", label: "Where: With us" }]);
    expect(appliedWorksFilters(parseWorksListQuery({}))).toEqual([]);
  });
});
