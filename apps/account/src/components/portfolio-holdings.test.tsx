import { textOf } from "@/test/text-of";
import { buildHoldings, holdingsFilterOptions } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { item } from "../server/domain/portfolio-fixtures.test-util";
import { PortfolioHoldings } from "./portfolio-holdings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

type Item = ReturnType<typeof item>;

function render(items: Item[], filter = {}) {
  return renderToStaticMarkup(
    <PortfolioHoldings
      holdings={buildHoldings(items, filter)}
      options={holdingsFilterOptions(items)}
      filter={filter}
      action="/account/portfolio"
      totalCount={items.length}
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

  it("writes statuses in sentence case", () => {
    const html = render(works);
    expect(html).not.toMatch(/uppercase|tracking-widest/);
  });

  it("marks an unpaid work's amount as due, not paid", () => {
    expect(render(works)).toContain("Due");
  });

  it("offers search and a Filter button instead of rows of chips", () => {
    const html = render(works);
    expect(html).toContain('role="search"');
    expect(html).toContain("Search your works by title or artist");
    expect(html).toContain("Filter</button>");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("Showing 2 of 2 works");
    expect(html).not.toContain("Filter by ");
  });

  it("counts the active filters on the button and shows each as a removable chip", () => {
    const html = render(works, { statuses: ["owned"], currency: "GBP", search: "green" });
    expect(html).toContain(", 2 applied");
    expect(html).toContain('aria-label="Remove Status filter: Owned"');
    expect(html).toContain('aria-label="Remove Currency filter: GBP"');
    expect(html).toContain("Clear all");
    // The search text stays in the box and the form carries the filters for use without scripts.
    expect(html).toContain('value="green"');
    expect(html).toContain('name="status" value="owned"');
  });

  it("shows no chips or clear control when nothing is applied", () => {
    const html = render(works);
    expect(html).not.toContain("Active filters");
    expect(html).not.toContain("Clear all");
  });

  it("reports no results when filters hide every work", () => {
    const html = render(works, { artist: "Nobody" });
    expect(html).toContain("No works match these filters");
    expect(html).toContain("Clear all filters");
    expect(html).not.toContain("<table");
  });

  it("counts by artist and product, never as percentages", () => {
    const html = render(works);
    expect(html).toContain("Ada Artist 1");
    expect(textOf(html)).toContain("LAX Shop 1");
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
