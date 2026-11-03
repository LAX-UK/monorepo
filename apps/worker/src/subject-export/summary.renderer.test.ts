import { SUBJECT_EXPORT_CATEGORIES, SUBJECT_EXPORT_PRODUCTS } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import type { CollectedProduct } from "./product-collector.js";
import { escapeHtml, renderSummary } from "./summary.renderer.js";

function collected(counts: Record<string, number> = {}): CollectedProduct[] {
  return SUBJECT_EXPORT_PRODUCTS.map((product) => ({
    product,
    categories: SUBJECT_EXPORT_CATEGORIES[product].map((definition) => ({
      definition,
      schemaVersion: 1,
      count: counts[`${product}/${definition.id}`] ?? 0,
      zipPath: `${product}/${definition.id}.json`,
    })),
  }));
}

const render = (overrides: Partial<Parameters<typeof renderSummary>[0]> = {}) =>
  renderSummary({
    preparedAt: new Date("2026-11-02T14:03:11.000Z"),
    recipient: { name: "Sarah Whitfield", email: "s.whitfield@example.test" },
    products: collected({ "bid/bids": 126, "bid/purchases": 9, "shop/orders": 4 }),
    omittedFileCount: 0,
    ...overrides,
  });

describe("Your LAX data.html", () => {
  const html = render();

  it("is one self-contained file: no scripts, styles, fonts or images are fetched", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/src=/i);
    expect(html).not.toMatch(/url\(/i);
    expect(html).not.toMatch(/@import/i);
  });

  it("is built to be read by everyone: language, title, landmarks, one h1, labelled tables, skip link", () => {
    expect(html).toContain('<html lang="en-GB">');
    expect(html).toContain("<title>Your LAX data, prepared 2 November 2026</title>");
    expect(html).toContain('name="viewport"');
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).toContain("@media print");
    expect(html).toContain("<main");
    expect(html).toContain('<nav aria-label="Sections">');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="#main"');
    expect(html).toContain("<caption>");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
  });

  it("greets the person and shows the time in London", () => {
    expect(html).toContain("Prepared for Sarah Whitfield (s.whitfield@example.test)");
    expect(html).toContain("2 November 2026 at 14:03");
    const summer = render({ preparedAt: new Date("2026-07-01T12:00:00.000Z") });
    expect(summer).toContain("1 July 2026 at 13:00");
  });

  it("lists counts per product and says where nothing is held", () => {
    expect(html).toContain("<dt>Bids</dt><dd>126</dd>");
    expect(html).toContain("<dt>Purchases</dt><dd>9</dd>");
    expect(html).toContain("<dt>Orders</dt><dd>4</dd>");
    expect(html).toMatch(/Nothing held in: [^<]*Registrations/);
  });

  it("names each product's company", () => {
    expect(html).toContain("Kept by London Auction Xchange LTD.");
    expect(html).toContain("Kept by London Art Exchange Ltd.");
    expect(html).toContain("LAX Shop and lax.art");
  });

  it("links every section to its data file", () => {
    expect(html).toContain('href="bid/bids.json"');
    expect(html).toContain('href="shop/orders.json"');
    expect(html).toContain('href="account/profile.json"');
  });

  it("has the About your data section with purposes, recipients, retention and sources", () => {
    expect(html).toContain('id="about"');
    for (const heading of [
      "Why it is used",
      "Who it is shared with",
      "How long it is kept",
      "Where it came from",
    ]) {
      expect(html).toContain(heading);
    }
    for (const recipient of ["Stripe", "Xero", "Zoho", "Couriers"])
      expect(html).toContain(recipient);
  });

  it("has the gaps and the rights, with each company's contact", () => {
    expect(html).toContain("Not held by LAX");
    expect(html).toContain("Card and bank details");
    expect(html).toContain('id="rights"');
    expect(html).toContain("support@lax.bid");
    expect(html).toContain("info@lax.art");
    expect(html).toContain("London Auction Xchange LTD, 156 New Cavendish Street");
    expect(html).toContain("London Art Exchange Ltd, 156 New Cavendish Street");
    expect(html).toContain("Information Commissioner");
  });

  it("escapes what comes from the account", () => {
    const hostile = render({ recipient: { name: '<img src=x onerror="a()">', email: null } });
    expect(hostile).not.toContain("<img");
    expect(hostile).toContain("&lt;img src=x onerror=&quot;a()&quot;&gt;");
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("says nothing about a name it does not have, and counts omitted files", () => {
    const anonymous = render({ recipient: { name: null, email: null }, omittedFileCount: 2 });
    expect(anonymous).toContain("Prepared on 2 November 2026");
    expect(anonymous).toContain("2 uploaded files are not in this ZIP");
  });
});
