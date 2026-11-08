import { buildCollection } from "@/server/domain/collection.vm";
import { buildNeedsYou } from "@/server/domain/home-needs-you.vm";
import { buildAttentionRows } from "@/server/domain/portfolio-attention.vm";
import { item } from "@/server/domain/portfolio-fixtures.test-util";
import { buildWorksByProduct } from "@/server/domain/works-by-product.vm";
import { textOf } from "@/test/text-of";
import { buildPortfolioHeader } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollectionCard } from "./collection-card";
import { NeedsYouCard } from "./home-needs-you-card";
import { HomeNewPerson } from "./home-new-person";

const PAY = [{ kind: "pay" as const, href: "https://lax.bid/purchases/checkout/1" }];

const pay = (id: string) =>
  item({
    id,
    title: `Work ${id}`,
    status: "awaiting_payment",
    owed: { amount: 237_500, currency: "GBP", state: "due" },
    actions: PAY,
  });

const needsYou = (...items: Parameters<typeof buildAttentionRows>[0]) =>
  buildNeedsYou(buildAttentionRows(items));

describe("NeedsYouCard", () => {
  it("opens the purchase from the row and the Pay button, with one teal primary", () => {
    const html = renderToStaticMarkup(<NeedsYouCard needsYou={needsYou(pay("a"), pay("b"))} />);
    expect(textOf(html)).toContain("Pay for Work a");
    expect(html.match(/href="https:\/\/lax\.bid\/purchases\/checkout\/1"/g)).toHaveLength(4);
    expect(html.match(/bg-cta-bg/g)).toHaveLength(1);
    expect(html).toContain("See all in Portfolio");
  });

  it("counts the lines beyond three", () => {
    const html = renderToStaticMarkup(
      <NeedsYouCard needsYou={needsYou(pay("a"), pay("b"), pay("c"), pay("d"))} />,
    );
    expect(textOf(html)).toContain("1 more");
  });

  it("collapses to one calm line when nothing needs the person", () => {
    const html = renderToStaticMarkup(<NeedsYouCard needsYou={needsYou(item())} />);
    expect(textOf(html)).toContain("Needs you");
    expect(textOf(html)).toContain("Nothing needs you right now.");
    expect(textOf(html)).not.toContain("See all");
    expect(html).not.toContain("<ul");
  });
});

describe("CollectionCard", () => {
  const render = (
    items: Parameters<typeof buildAttentionRows>[0],
    props: { link?: { href: string; label: string }; showNotes?: boolean } = {},
  ) =>
    renderToStaticMarkup(
      <CollectionCard
        collection={buildCollection(buildPortfolioHeader(items), items.length)}
        chart={buildWorksByProduct(items)}
        incompleteNote={null}
        {...props}
      />,
    );

  it("shows counts, Total due, Paid so far and the chart with readable bars", () => {
    const html = render([
      pay("a"),
      item({
        id: "s1",
        product: "shop",
        paid: { lines: [{ kind: "price", amount: 8_500, currency: "GBP" }] },
      }),
    ]);
    const text = textOf(html);
    expect(text).toContain("Total due");
    expect(text).toContain("£2,375.00");
    expect(text).toContain("Paid so far");
    expect(text).toContain("LAX Shop, 1 work");
    expect(text).toContain("LAX Bid, 1 work");
    expect(text).toContain("lax.art, 0 works");
  });

  it("links to Portfolio from Home and has no link on Portfolio itself", () => {
    const items = [item({ status: "owned" })];
    const home = render(items, { link: { href: "/account/portfolio", label: "View portfolio" } });
    expect(home).toContain('href="/account/portfolio"');
    expect(textOf(home)).toContain("View portfolio");
    expect(render(items)).not.toContain("View portfolio");
  });

  it("keeps the three counts in one row with the short labels for phones", () => {
    const html = render([
      item({ id: "a", status: "owned" }),
      item({ id: "b", status: "in_sale" }),
      pay("c"),
    ]);
    expect(html).toContain("grid-cols-3");
    expect(html).toContain(">Owned<");
    expect(html).toContain(">In sale<");
    expect(html).toContain(">To pay<");
    expect(html).toContain(">Works owned<");
    expect(html).toContain(">In sale or consigned<");
  });

  it("explains the money lines on Portfolio only, naming the invoices held for identity checks", () => {
    const held = item({
      id: "h",
      status: "awaiting_payment",
      owed: { amount: 115_000, currency: "GBP", state: "in_review", blocker: "review" },
    });
    const paid = item({
      id: "p",
      paid: { lines: [{ kind: "price", amount: 100_000, currency: "GBP" }] },
    });
    const withNotes = textOf(render([held, pay("a"), paid], { showNotes: true }));
    expect(withNotes).toContain("Includes 1 waiting on identity checks.");
    expect(withNotes).toContain("in the currency you paid. Not a valuation.");
    expect(textOf(render([held, pay("a"), paid]))).not.toContain("waiting on identity checks");
  });

  it("puts each money note in the same div as its term and figure, never in a nested wrapper", () => {
    const paid = item({
      id: "p",
      paid: { lines: [{ kind: "price", amount: 100_000, currency: "GBP" }] },
    });
    const html = render([pay("a"), paid], { showNotes: true });
    expect(html).toMatch(/<\/dd><dd class="col-span-2[^"]*">/);
    expect(html).not.toMatch(/<dl[^>]*><div[^>]*><div/);
  });

  it("shows paid so far per currency, side by side, never as one total", () => {
    const html = render(
      [
        item({
          id: "1",
          paid: { lines: [{ kind: "hammer", amount: 1_240_000, currency: "GBP" }] },
        }),
        item({ id: "2", paid: { lines: [{ kind: "price", amount: 310_000, currency: "EUR" }] } }),
      ],
      { showNotes: true },
    );
    expect(html).toContain("£12,400.00");
    expect(html).toContain("€3,100.00");
    expect(html).not.toContain("£15,500");
  });

  it("does not count an unpaid invoice as paid, and offers no valuation wording", () => {
    const html = render(
      [
        item({
          status: "awaiting_payment",
          paid: { lines: [{ kind: "hammer", amount: 500_000, currency: "GBP" }] },
        }),
      ],
      { showNotes: true },
    );
    expect(html).not.toContain("£5,000");
    for (const word of ["gain", "loss", "return", "total value", "invest"]) {
      expect(html.toLowerCase()).not.toContain(word);
    }
  });

  it("leaves out the money lines and the chart when there is nothing to show", () => {
    const html = render([item({ status: "owned" })]);
    expect(textOf(html)).not.toContain("Total due");
    expect(textOf(html)).not.toContain("Works by product");
  });
});

describe("HomeNewPerson", () => {
  it("invites a first work with the three products as actions", () => {
    const html = renderToStaticMarkup(
      <HomeNewPerson
        products={[
          { id: "art", name: "lax.art", invitation: "", href: "https://lax.art" },
          { id: "shop", name: "LAX Shop", invitation: "", href: "https://shop.lax.bid" },
          { id: "bid", name: "LAX Bid", invitation: "", href: "https://lax.bid" },
        ]}
      />,
    );
    const text = textOf(html);
    expect(text).toContain("Start your collection");
    for (const name of ["lax.art", "LAX Shop", "LAX Bid"]) expect(text).toContain(`Open ${name}`);
  });
});
