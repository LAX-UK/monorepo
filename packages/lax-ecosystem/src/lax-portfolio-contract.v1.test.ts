import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { LaxMoneyEntryV1, LaxPortfolioItemV1 } from "./lax-portfolio-contract.v1.js";
import { item, moneyEntry } from "./portfolio-fixtures.test-util.js";

describe("LaxPortfolioItemV1", () => {
  it("accepts a complete item", () => {
    const full = item({
      image: "https://cdn.example/a.jpg",
      paid: { lines: [{ kind: "hammer", amount: 100, currency: "GBP" }] },
      documents: [{ kind: "invoice", available: true, href: "/i/1" }],
      actions: [{ kind: "view", href: "/lots/1" }],
    });
    expect(Value.Check(LaxPortfolioItemV1, full)).toBe(true);
  });

  it.each([
    ["a float amount", { paid: { lines: [{ kind: "hammer", amount: 1.5, currency: "GBP" }] } }],
    [
      "a lower-case currency",
      { paid: { lines: [{ kind: "hammer", amount: 1, currency: "gbp" }] } },
    ],
    ["an unknown status", { status: "lost" }],
    ["a date without a time", { acquiredAt: "2026-03-01" }],
    ["an unknown business", { business: { key: "lax_stock", legalName: "x" } }],
    ["a negative amount", { paid: { lines: [{ kind: "fees", amount: -1, currency: "GBP" }] } }],
  ])("rejects %s", (_name, patch) => {
    expect(Value.Check(LaxPortfolioItemV1, { ...item(), ...patch })).toBe(false);
  });
});

describe("LaxMoneyEntryV1", () => {
  it("accepts a valid entry and rejects an unknown direction", () => {
    expect(Value.Check(LaxMoneyEntryV1, moneyEntry())).toBe(true);
    expect(Value.Check(LaxMoneyEntryV1, { ...moneyEntry(), direction: "netted" })).toBe(false);
  });
});
