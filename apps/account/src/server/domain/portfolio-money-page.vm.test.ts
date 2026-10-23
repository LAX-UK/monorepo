import { describe, expect, it } from "vitest";
import { moneyEntry } from "./portfolio-fixtures.test-util";
import { buildMoneyPage } from "./portfolio-money-page.vm";

describe("buildMoneyPage", () => {
  it("offers only the currencies that exist, sorted", () => {
    const vm = buildMoneyPage(
      [moneyEntry({ currency: "GBP" }), moneyEntry({ id: "2", currency: "EUR" })],
      { currency: "GBP" },
      true,
    );
    expect(vm.currencies).toEqual(["EUR", "GBP"]);
    expect(vm.money.ledger).toHaveLength(1);
  });

  it("claims an empty ledger only when every product answered in full", () => {
    expect(buildMoneyPage([], {}, true).showEmptyState).toBe(true);
    expect(buildMoneyPage([], {}, false).showEmptyState).toBe(false);
    expect(buildMoneyPage([moneyEntry()], {}, true).showEmptyState).toBe(false);
  });

  it("splits pending and completed payouts into two sections under one business", () => {
    const vm = buildMoneyPage(
      [
        moneyEntry({ id: "a", direction: "owed_to_you", status: "pending", amount: 500 }),
        moneyEntry({ id: "b", direction: "owed_to_you", status: "completed", amount: 900 }),
      ],
      {},
      true,
    );
    expect(vm.money.groups[0]?.sections.map((section) => section.section)).toEqual([
      "due_to_you",
      "received",
    ]);
  });
});
