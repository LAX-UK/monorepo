import { buildCollection } from "@/server/domain/home-collection.vm";
import { buildNeedsYou } from "@/server/domain/home-needs-you.vm";
import { buildWorksByProduct } from "@/server/domain/home-works-by-product.vm";
import { buildAttentionRows } from "@/server/domain/portfolio-attention.vm";
import { item } from "@/server/domain/portfolio-fixtures.test-util";
import { textOf } from "@/test/text-of";
import { buildPortfolioHeader } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollectionCard } from "./home-collection-card";
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
    expect(textOf(html)).toContain("Nothing needs you right now.");
    expect(html).not.toContain("<ul");
  });
});

describe("CollectionCard", () => {
  const render = (items: Parameters<typeof buildAttentionRows>[0]) =>
    renderToStaticMarkup(
      <CollectionCard
        collection={buildCollection(buildPortfolioHeader(items), items.length)}
        chart={buildWorksByProduct(items)}
        incompleteNote={null}
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
          { id: "art", name: "lax.art", tagline: "", href: "https://lax.art" },
          { id: "shop", name: "LAX Shop", tagline: "", href: "https://shop.lax.bid" },
          { id: "bid", name: "LAX Bid", tagline: "", href: "https://lax.bid" },
        ]}
      />,
    );
    const text = textOf(html);
    expect(text).toContain("Start your collection");
    for (const name of ["lax.art", "LAX Shop", "LAX Bid"]) expect(text).toContain(`Open ${name}`);
  });
});
