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

describe("PortfolioMoney still to send", () => {
  it("says the rest of a part-paid transfer is still to send, beside its owed amount", () => {
    const html = render([
      moneyEntry({
        id: "rest",
        direction: "owed_by_you",
        status: "pending",
        amount: 570_100,
        stillToSend: true,
      }),
      moneyEntry({ id: "bill", direction: "owed_by_you", status: "pending", amount: 90_000 }),
    ]);
    expect(html).toContain("£5,701.00 still to send on your bank transfer");
    // Only the transfer's rest carries the note; an ordinary amount owed does not.
    expect(html.match(/still to send on your bank transfer/g)).toHaveLength(2);
    expect(html).toContain("£6,601.00");
  });
});

describe("PortfolioMoney", () => {
  it("shows a summary card per business, Bid then Art", () => {
    const html = render(entries);
    expect(html.indexOf("LAX Bid Ltd")).toBeLessThan(html.indexOf("London Art Exchange Ltd"));
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

  it("lays the phone ledger out as compact rows: amount, product and type, date, status", () => {
    const html = render(entries);
    expect(html).toContain('aria-label="Ledger"');
    expect(textOf(html)).toContain("LAX Bid · Owed by you");
    expect(html).toContain("1 Mar 2026");
  });

  it("writes statuses in sentence case", () => {
    const html = render(entries);
    expect(html).toContain("Pending");
    expect(html).not.toMatch(/uppercase|tracking-widest/);
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

describe("PortfolioMoney ledger product column", () => {
  const ledgerEntries = [
    moneyEntry({ id: "bid", occurredAt: "2026-03-03T10:00:00.000Z" }),
    moneyEntry({
      id: "shop",
      business: ART_BUSINESS,
      product: "shop",
      occurredAt: "2026-03-02T10:00:00.000Z",
      href: "https://shop.lax.art/account/orders/1",
    }),
    moneyEntry({
      id: "art",
      business: ART_BUSINESS,
      product: "art",
      occurredAt: "2026-03-01T10:00:00.000Z",
      href: "https://lax.art/account/collection",
    }),
  ];

  it("leads each line with the product in its accent, with the legal entity as a muted second line", () => {
    const html = render(ledgerEntries);
    expect(html).toContain("Product");
    expect(html).not.toContain(">Business<");
    for (const product of ["bid", "shop", "art"]) {
      expect(html).toContain(`data-product="${product}"`);
    }
    expect(html).toContain('class="block text-xs text-on-surface-variant">London Art Exchange Ltd');
  });

  it("says LAX Shop and links to LAX Shop for a Shop payment", () => {
    const text = textOf(render(ledgerEntries));
    expect(text).toContain("Open in LAX Shop");
    expect(text).toContain("Open in lax.art");
    expect(text).toContain("Open in LAX Bid");
  });

  it("names the products each business covers under its summary card title", () => {
    const html = render(ledgerEntries);
    expect(textOf(html)).toContain("LAX Shop · lax.art");
  });

  it("reads an entry without a product as its business's product", () => {
    const text = textOf(render([moneyEntry({ business: ART_BUSINESS })]));
    expect(text).toContain("Open in lax.art");
    expect(text).not.toContain("Open in LAX Shop");
  });

  it("puts the product first on a phone row", () => {
    const html = render(ledgerEntries);
    const phoneRows = html.slice(html.indexOf('aria-label="Ledger"'));
    expect(phoneRows).toMatch(/data-product="shop"[^>]*>LAX Shop<\/span> · Paid/);
  });
});
