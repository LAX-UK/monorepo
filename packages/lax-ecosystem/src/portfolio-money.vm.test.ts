import { describe, expect, it } from "vitest";
import { ART_BUSINESS, moneyEntry } from "./portfolio-fixtures.test-util.js";
import { buildMoney } from "./portfolio-money.vm.js";

describe("buildMoney", () => {
  it("is empty for no entries", () => {
    expect(buildMoney([])).toMatchObject({
      groups: [],
      ledger: [],
      isEmpty: true,
      noResults: false,
    });
  });

  it("groups by business in a fixed order, then by direction", () => {
    const vm = buildMoney([
      moneyEntry({ id: "1", business: ART_BUSINESS, direction: "fee" }),
      moneyEntry({ id: "2", direction: "paid" }),
      moneyEntry({ id: "3", direction: "owed_by_you", status: "pending" }),
    ]);
    expect(vm.groups.map((g) => g.legalName)).toEqual(["LAX Bid Ltd", "LAX Art Ltd"]);
    expect(vm.groups[0]?.sections.map((s) => s.direction)).toEqual(["owed_by_you", "paid"]);
  });

  it("subtotals per currency without mixing them", () => {
    const vm = buildMoney([
      moneyEntry({ id: "1", amount: 1000, currency: "GBP" }),
      moneyEntry({ id: "2", amount: 500, currency: "GBP" }),
      moneyEntry({ id: "3", amount: 700, currency: "EUR" }),
    ]);
    expect(vm.groups[0]?.sections[0]?.subtotals).toEqual([
      { currency: "EUR", amount: 700 },
      { currency: "GBP", amount: 1500 },
    ]);
  });

  it("never nets owed by you against owed to you", () => {
    const vm = buildMoney([
      moneyEntry({ id: "1", direction: "owed_by_you", status: "pending", amount: 900 }),
      moneyEntry({ id: "2", direction: "owed_to_you", status: "pending", amount: 400 }),
    ]);
    const sections = vm.groups[0]?.sections ?? [];
    expect(sections.map((s) => [s.direction, s.subtotals])).toEqual([
      ["owed_by_you", [{ currency: "GBP", amount: 900 }]],
      ["owed_to_you", [{ currency: "GBP", amount: 400 }]],
    ]);
  });

  it("lists cancelled entries but leaves them out of subtotals", () => {
    const vm = buildMoney([
      moneyEntry({ id: "1", amount: 1000 }),
      moneyEntry({ id: "2", amount: 300, status: "cancelled" }),
    ]);
    const section = vm.groups[0]?.sections[0];
    expect(section?.entries).toHaveLength(2);
    expect(section?.subtotals).toEqual([{ currency: "GBP", amount: 1000 }]);
  });

  it("orders the ledger newest first", () => {
    const vm = buildMoney([
      moneyEntry({ id: "old", occurredAt: "2026-01-01T00:00:00.000Z" }),
      moneyEntry({ id: "new", occurredAt: "2026-06-01T00:00:00.000Z" }),
    ]);
    expect(vm.ledger.map((e) => e.id)).toEqual(["new", "old"]);
  });

  it("filters by business, direction and currency and flags no results", () => {
    const entries = [
      moneyEntry({ id: "1" }),
      moneyEntry({ id: "2", business: ART_BUSINESS, currency: "EUR", direction: "refunded" }),
    ];
    expect(buildMoney(entries, { business: "lax_art" }).ledger.map((e) => e.id)).toEqual(["2"]);
    expect(buildMoney(entries, { direction: "paid" }).ledger.map((e) => e.id)).toEqual(["1"]);
    expect(buildMoney(entries, { currency: "EUR" }).ledger.map((e) => e.id)).toEqual(["2"]);
    expect(buildMoney(entries, { currency: "USD" })).toMatchObject({
      groups: [],
      noResults: true,
      isEmpty: false,
    });
  });
});
