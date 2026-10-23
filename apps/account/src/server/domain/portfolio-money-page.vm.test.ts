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

describe("buildMoneyPage summary", () => {
  const entries = [
    moneyEntry({ id: "a", direction: "owed_by_you", amount: 900, currency: "GBP" }),
    moneyEntry({ id: "b", direction: "owed_by_you", amount: 300, currency: "EUR" }),
    moneyEntry({ id: "c", direction: "owed_to_you", status: "pending", amount: 400 }),
    moneyEntry({ id: "d", direction: "refunded", amount: 50 }),
    moneyEntry({ id: "e", direction: "paid", status: "cancelled", amount: 70 }),
  ];

  it("gives one line per category with a separate total per currency", () => {
    const [card] = buildMoneyPage(entries, {}, true).summary;
    expect(card?.lines.map((line) => line.label)).toEqual([
      "Owed by you",
      "Due to you",
      "Paid",
      "Refunded",
    ]);
    const owed = card?.lines.find((line) => line.section === "owed_by_you");
    expect(owed?.totals).toHaveLength(2);
    expect(owed?.totals).toEqual(
      expect.arrayContaining([
        { currency: "GBP", amount: 900 },
        { currency: "EUR", amount: 300 },
      ]),
    );
  });

  it("never counts cancelled entries and never nets one category against another", () => {
    const [card] = buildMoneyPage(entries, {}, true).summary;
    expect(card?.lines.find((line) => line.section === "paid")?.totals).toEqual([]);
    expect(card?.lines.find((line) => line.section === "due_to_you")?.totals).toEqual([
      { currency: "GBP", amount: 400 },
    ]);
  });

  it("links each business to its own ledger and keeps the other filters", () => {
    const vm = buildMoneyPage(entries, { currency: "GBP", section: "owed_by_you" }, true);
    expect(vm.summary[0]?.ledgerHref).toBe(
      "/account/portfolio/money?business=lax_bid&section=owed_by_you&currency=GBP#ledger",
    );
  });

  it("has no cards when there is nothing to summarise", () => {
    expect(buildMoneyPage([], {}, true).summary).toEqual([]);
  });
});
