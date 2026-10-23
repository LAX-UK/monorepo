import { buildHoldings, holdingsFilterOptions } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { item } from "../server/domain/portfolio-fixtures.test-util";
import { PortfolioHoldings } from "./portfolio-holdings";

type Item = ReturnType<typeof item>;

function render(items: Item[], filter = {}) {
  return renderToStaticMarkup(
    <PortfolioHoldings
      holdings={buildHoldings(items, filter)}
      options={holdingsFilterOptions(items)}
      filter={filter}
      action="/account/portfolio"
      imageOrigins={["https://cdn.lax.bid"]}
    />,
  );
}

const works = [
  item({
    id: "lot 1",
    title: "Green Line",
    artist: "Ada Artist",
    paid: { lines: [{ kind: "hammer", amount: 100_000, currency: "GBP" }] },
    documents: [
      { kind: "invoice", available: true, href: "https://lax.bid/i/1" },
      { kind: "certificate", available: false },
    ],
  }),
  item({
    id: "e1",
    product: "shop",
    title: "Blue Edition",
    artist: "Bo Maker",
    status: "awaiting_payment",
    acquiredAt: "2026-05-01T10:00:00.000Z",
    paid: { lines: [{ kind: "price", amount: 25_000, currency: "EUR" }] },
  }),
];

describe("PortfolioHoldings", () => {
  it("renders a captioned table with column headers and a card list for phones", () => {
    const html = render(works);
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
    for (const heading of ["Work", "Product", "Acquired", "Paid", "Status", "Documents"]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain('aria-label="Your works"');
  });

  it("links each work to its page with the id escaped", () => {
    expect(render(works)).toContain('href="/account/portfolio/bid/lot%201"');
  });

  it("shows product badges, status, each cost in its own currency and a document summary", () => {
    const html = render(works);
    expect(html).toContain("LAX Bid");
    expect(html).toContain("LAX Shop");
    expect(html).toContain("Awaiting payment");
    expect(html).toContain("£1,000.00");
    expect(html).toContain("€250.00");
    expect(html).toContain("1 available, 1 expected");
  });

  it("marks an unpaid work's amount as due, not paid", () => {
    expect(render(works)).toContain("Due");
  });

  it("offers every filter, keeps the URL values selected, and can clear them", () => {
    const html = render(works, { statuses: ["owned"], currency: "GBP" });
    for (const label of ["status", "product", "artist", "year acquired", "currency"]) {
      expect(html).toContain(`Filter by ${label}`);
    }
    // A chip changes one filter and keeps the others, so filters combine.
    expect(html).toContain(
      'href="/account/portfolio?status=owned&amp;product=bid&amp;currency=GBP"',
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Clear filters");
  });

  it("reports no results when filters hide every work", () => {
    const html = render(works, { artist: "Nobody" });
    expect(html).toContain("No works match these filters");
    expect(html).not.toContain("<table");
  });

  it("counts by artist and product, never as percentages", () => {
    const html = render(works);
    expect(html).toContain("Ada Artist 1");
    expect(html).toContain("LAX Shop 1");
    expect(html).not.toMatch(/\d%/);
  });

  it("shows images from allowed media origins only", () => {
    const html = render([
      item({ id: "ok", image: "https://cdn.lax.bid/a.jpg" }),
      item({ id: "bad", image: "https://evil.example/b.jpg" }),
    ]);
    expect(html).toContain("https://cdn.lax.bid/a.jpg");
    expect(html).not.toContain("evil.example");
  });
});
