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
    owed: { amount: 25_000, currency: "EUR", state: "due" },
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
    expect(html).toContain('aria-label="Works and purchases"');
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

  it("labels the rest of a part-paid transfer as still to send, not as due or paid", () => {
    const html = render([
      item({
        id: "lot 7",
        title: "Red Field",
        status: "awaiting_payment",
        owed: { amount: 389_779, currency: "GBP", state: "still_to_send" },
      }),
    ]);
    expect(html).toContain("Still to send");
    expect(html).toContain("£3,897.79");
    expect(html).not.toMatch(/>Due</);
  });

  it("shows the total due for an unpaid work, not its hammer price, and notes a hold", () => {
    const unpaid = item({
      id: "lot 9",
      title: "Blue Study",
      status: "awaiting_payment",
      paid: { lines: [{ kind: "hammer", amount: 100_000, currency: "GBP" }] },
      owed: { amount: 115_000, currency: "GBP", state: "in_review", blocker: "documents" },
    });
    const html = render([unpaid]);
    expect(html).toContain("£1,150.00");
    expect(html).not.toContain("£1,000.00");
    expect(html).toContain("Waiting on account checks");
  });

  it("names the list so it cannot contradict the owned count", () => {
    const html = render(works);
    expect(html).toContain("Works and purchases");
    expect(html).not.toContain(">Your works<");
  });

  it("offers search and a Filter button instead of rows of chips", () => {
    const html = render(works);
    expect(html).toContain('role="search"');
    expect(html).toContain("Search your works by title or artist");
    expect(html).toContain("Filter</button>");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("2 works");
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

  it("counts by artist, never as percentages, and leaves the product split to the summary chart", () => {
    const html = render(works);
    expect(html).toContain("Ada Artist 1");
    expect(textOf(html)).not.toContain("By product");
    expect(textOf(html)).not.toMatch(/\d%/);
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

/** The copies toggles in rendered markup: each `<button>` and whether it is expanded, in any attribute order. */
function copyToggles(html: string): { expanded: boolean; text: string }[] {
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .map(([, attrs = "", inner = ""]) => ({
      attrs,
      text: inner.replace(/<[^>]+>/g, ""),
    }))
    .filter((button) => / copies/.test(button.text) && /aria-expanded=/.test(button.attrs))
    .map((button) => ({
      expanded: /aria-expanded="true"/.test(button.attrs),
      text: button.text,
    }));
}

describe("PortfolioHoldings grouped copies", () => {
  const reed = (number: number, overrides: Parameters<typeof item>[0] = {}) =>
    item({
      product: "shop",
      id: `reed-${number}`,
      title: "Reed Study",
      artist: "Flora Powers",
      edition: `No. ${number} of 24 · Hand-signed`,
      paid: { lines: [{ kind: "price", amount: 40_000, currency: "GBP" }] },
      ...overrides,
    });
  const copies = Array.from({ length: 10 }, (_, index) => reed(index + 1));

  it("shows ten copies as one row that is collapsed until asked", () => {
    const html = render(copies);
    const text = textOf(html);
    const toggles = copyToggles(html);
    expect(toggles).toHaveLength(2);
    expect(toggles.every((toggle) => !toggle.expanded && toggle.text.startsWith("10 copies"))).toBe(
      true,
    );
    expect(text).toContain("Reed Study");
    expect(text).toContain("10 copies of Reed Study");
    expect(text).toContain("10 works in 1 row");
    expect(text).not.toContain("No. 3 of 24");
    expect(text).toContain("£4,000.00");
  });

  it("names the toggle with a button a keyboard can reach", () => {
    const html = render(copies);
    const [toggle] = copyToggles(html);
    expect(toggle?.expanded).toBe(false);
    expect(toggle?.text).toContain("10 copies");
  });

  it("leaves a single copy as a plain row with a link and no toggle", () => {
    const html = render([reed(1)]);
    expect(html).not.toContain(" copies");
    expect(html).toContain('href="/account/portfolio/shop/reed-1"');
    expect(textOf(html)).toContain("1 work");
  });

  it("shows Mixed when the copies are in different statuses", () => {
    const html = render([...copies, reed(11, { status: "awaiting_payment" })]);
    expect(textOf(html)).toContain("Mixed");
    expect(html).toContain('data-tone="warning"');
  });

  it("opens to the matching copies when a filter narrows the group", () => {
    const items = [...copies, reed(11, { status: "in_sale" }), reed(12, { status: "in_sale" })];
    const filter = { statuses: ["in_sale" as const] };
    const html = render(items, filter);
    const text = textOf(html);
    expect(copyToggles(html).some((toggle) => toggle.expanded)).toBe(true);
    expect(text).toContain("No. 11 of 24");
    expect(text).toContain("No. 12 of 24");
    expect(text).not.toContain("No. 3 of 24");
    expect(text).toContain("Showing 2 of 12 works");
  });
});
