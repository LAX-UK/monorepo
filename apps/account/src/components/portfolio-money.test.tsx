import { textOf } from "@/test/text-of";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ART_BUSINESS, moneyEntry } from "../server/domain/portfolio-fixtures.test-util";
import { buildMoneyPage } from "../server/domain/portfolio-money-page.vm";
import { MONEY_SEPARATION_NOTE, PortfolioMoney } from "./portfolio-money";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

type Entry = ReturnType<typeof moneyEntry>;

function render(entries: Entry[], filter = {}) {
  return renderToStaticMarkup(
    <PortfolioMoney
      page={buildMoneyPage(entries, filter, true)}
      filter={filter}
      action="/account/portfolio/money"
      totalCount={entries.length}
    />,
  );
}

const entries = [
  moneyEntry({ id: "owe", direction: "owed_by_you", status: "pending", amount: 90_000 }),
  moneyEntry({ id: "due", direction: "owed_to_you", status: "pending", amount: 40_000 }),
  moneyEntry({ id: "got", direction: "owed_to_you", status: "completed", amount: 250_000 }),
  moneyEntry({
    id: "art",
    business: ART_BUSINESS,
    direction: "paid",
    currency: "EUR",
    amount: 12_000,
    href: "https://shop.lax.art/orders/1",
  }),
];

describe("PortfolioMoney", () => {
  it("shows a summary card per business, Bid then Art", () => {
    const html = render(entries);
    expect(html.indexOf("LAX Bid Ltd")).toBeLessThan(html.indexOf("LAX Art Ltd"));
    expect(html).toContain('aria-label="Totals by business"');
  });

  it("lists totals per category and never nets or blends them", () => {
    const html = render(entries);
    for (const label of ["Owed by you", "Due to you", "Received", "Paid"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("£900.00");
    expect(html).toContain("£400.00");
    expect(html).toContain("£2,500.00");
    expect(html).toContain("€120.00");
    expect(html).not.toContain("£500.00");
    expect(html).not.toContain("£2,900.00");
    expect(html).toContain(MONEY_SEPARATION_NOTE);
  });

  it("shows each payment line once, in the ledger, not again under its business", () => {
    const html = render(entries);
    expect(html.match(/Open in LAX Bid/g)).toHaveLength(6);
    expect(html.match(/<caption/g)).toHaveLength(1);
    expect(html).toContain('id="ledger"');
  });

  it("links each business card to the ledger filtered to that business", () => {
    const html = render(entries);
    expect(html).toContain('href="/account/portfolio/money?business=lax_bid#ledger"');
    expect(html).toContain('href="/account/portfolio/money?business=lax_art#ledger"');
  });

  it("lays the phone ledger out as compact rows: amount, type and business, date, status", () => {
    const html = render(entries);
    expect(html).toContain('aria-label="Ledger"');
    expect(textOf(html)).toContain("Owed by you · LAX Bid Ltd");
    expect(html).toContain("1 Mar 2026");
  });

  it("writes statuses in sentence case", () => {
    const html = render(entries);
    expect(html).toContain("Pending");
    expect(html).toContain("normal-case");
  });

  it("links each entry to its product and drops an unsafe link", () => {
    const html = render([
      ...entries,
      moneyEntry({ id: "bad", href: "javascript:alert(1)", direction: "fee" }),
    ]);
    expect(html).toContain('href="https://shop.lax.art/orders/1"');
    expect(html).toContain("Open in lax.art");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("No link");
  });

  it("offers a Filter button counting the applied filters, with a chip for each", () => {
    const html = render(entries, { currency: "GBP" });
    expect(html).toContain(">Filter<");
    expect(html).toContain(", 1 applied");
    expect(html).toContain('aria-label="Remove Currency filter: GBP"');
    expect(html).toContain("Showing 3 of 4 entries");
    expect(html).not.toContain('role="search"');
  });

  it("reports no results when filters hide every entry", () => {
    const html = render(entries, { currency: "USD" });
    expect(html).toContain("No money entries match these filters");
    expect(html).toContain("Clear all filters");
  });
});
