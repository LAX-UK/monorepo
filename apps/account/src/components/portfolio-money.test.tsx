import { buildMoney } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART_BUSINESS, moneyEntry } from "../server/domain/portfolio-fixtures.test-util";
import { MONEY_SEPARATION_NOTE, PortfolioMoney } from "./portfolio-money";

type Entry = ReturnType<typeof moneyEntry>;

function render(entries: Entry[], filter = {}) {
  return renderToStaticMarkup(
    <PortfolioMoney
      vm={buildMoney(entries, filter)}
      filter={filter}
      action="/account/portfolio/money"
      currencies={["EUR", "GBP"]}
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
  it("groups by legal name, in the order Bid then Art", () => {
    const html = render(entries);
    expect(html.indexOf("LAX Bid Ltd")).toBeLessThan(html.indexOf("LAX Art Ltd"));
  });

  it("presents payouts as two sections, Due to you and Received", () => {
    const html = render(entries);
    expect(html).toContain("Due to you");
    expect(html).toContain("Received");
    expect(html).toContain("£400.00");
    expect(html).toContain("£2,500.00");
    expect(html).not.toContain("£2,900.00");
  });

  it("never nets what you owe against what you are owed", () => {
    const html = render(entries);
    expect(html).toContain("Owed by you");
    expect(html).toContain("£900.00");
    expect(html).not.toContain("£500.00");
    expect(html).toContain(MONEY_SEPARATION_NOTE);
  });

  it("shows a captioned table per section and a ledger table with a phone card list", () => {
    const html = render(entries);
    expect(html.match(/<caption/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain("Ledger");
    expect(html).toContain('aria-label="Ledger"');
  });

  it("links each entry to its product and drops an unsafe link", () => {
    const html = render([
      ...entries,
      moneyEntry({ id: "bad", href: "javascript:alert(1)", direction: "fee" }),
    ]);
    expect(html).toContain('href="https://shop.lax.art/orders/1"');
    expect(html).toContain("Open in LAX Art");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("No link");
  });

  it("offers business, type and currency filters", () => {
    const html = render(entries, { currency: "GBP" });
    for (const name of ["business", "section", "currency"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain("Clear filters");
  });

  it("reports no results when filters hide every entry", () => {
    const html = render(entries, { currency: "USD" });
    expect(html).toContain("No money entries match these filters");
  });
});
