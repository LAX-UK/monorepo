import { textOf } from "@/test/text-of";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildAttentionRows } from "../server/domain/portfolio-attention.vm";
import { buildSourceNotices } from "../server/domain/portfolio-composition";
import { item } from "../server/domain/portfolio-fixtures.test-util";
import { buildPortfolioSummary } from "../server/domain/portfolio-summary.vm";
import { PortfolioAttention } from "./portfolio-attention";
import { NO_DOCUMENTS_NOTE, PortfolioEmptyState } from "./portfolio-empty-state";
import { PortfolioNotices } from "./portfolio-notices";
import { OrganisationsCard, PortfolioSummaryCard } from "./portfolio-overview-cards";

const products = [
  { id: "bid" as const, name: "LAX Bid", tagline: "", href: "https://lax.bid" },
  { id: "shop" as const, name: "LAX Shop", tagline: "", href: "https://shop.lax.art" },
];

describe("PortfolioEmptyState", () => {
  it("welcomes a new collector and links to each product", () => {
    const html = renderToStaticMarkup(
      <PortfolioEmptyState kind="new_collector" products={products} payHref={null} />,
    );
    expect(textOf(html)).toContain("Works you buy on LAX Bid, LAX Shop or lax.art appear here");
    expect(html).toContain('href="https://lax.bid"');
    expect(html).toContain('href="https://shop.lax.art"');
  });

  it("leads with Pay when the only works are awaiting payment", () => {
    const html = renderToStaticMarkup(
      <PortfolioEmptyState
        kind="only_awaiting_payment"
        products={products}
        payHref="https://lax.bid/purchases/checkout/1"
      />,
    );
    expect(html).toContain("Pay now");
    expect(html).toContain('href="https://lax.bid/purchases/checkout/1"');
  });

  it("tells a collector with no documents which are coming", () => {
    const html = renderToStaticMarkup(
      <PortfolioEmptyState kind="no_documents" products={products} payHref={null} />,
    );
    expect(html).toContain(NO_DOCUMENTS_NOTE);
  });
});

describe("PortfolioNotices", () => {
  it("names the product that is unavailable", () => {
    const html = renderToStaticMarkup(
      <PortfolioNotices
        notices={buildSourceNotices({ unavailable: ["bid"], partial: [] }, "items")}
      />,
    );
    expect(textOf(html)).toContain("LAX Bid items are unavailable right now");
  });

  it("renders nothing when every product answered", () => {
    expect(renderToStaticMarkup(<PortfolioNotices notices={[]} />)).toBe("");
  });
});

describe("PortfolioAttention", () => {
  it("renders whole-row links into the product and hides when nothing needs attention", () => {
    const rows = buildAttentionRows([
      item({
        status: "awaiting_payment",
        actions: [{ kind: "pay", href: "https://lax.bid/purchases/checkout/1" }],
      }),
    ]);
    const html = renderToStaticMarkup(<PortfolioAttention rows={rows} />);
    expect(html).toContain("Needs your attention");
    expect(html).toContain('href="https://lax.bid/purchases/checkout/1"');
    expect(textOf(html)).toContain("Opens LAX Bid");
    expect(renderToStaticMarkup(<PortfolioAttention rows={[]} />)).toBe("");
  });
});

describe("overview cards", () => {
  it("shows the portfolio counts with a link, and flags an incomplete load", () => {
    const summary = buildPortfolioSummary({
      rows: [item({ status: "owned" })],
      complete: false,
      unavailable: ["shop"],
    });
    const html = renderToStaticMarkup(<PortfolioSummaryCard summary={summary} />);
    expect(html).toContain("1 work owned");
    expect(html).toContain("may be low");
    expect(html).toContain('href="/account/portfolio"');
  });

  it("links the organisations card into Bid", () => {
    const html = renderToStaticMarkup(<OrganisationsCard href="https://lax.bid/organisations" />);
    expect(html).toContain("Your organisations");
    expect(html).toContain('href="https://lax.bid/organisations"');
    expect(html).toContain("Open in LAX Bid");
  });
});
