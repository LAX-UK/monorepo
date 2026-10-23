import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { item } from "../server/domain/portfolio-fixtures.test-util";
import { buildWorkDetail } from "../server/domain/portfolio-work-detail.vm";
import { PortfolioWorkDetail } from "./portfolio-work-detail";

const work = item({
  paid: {
    lines: [
      { kind: "hammer", amount: 100_000, currency: "GBP" },
      { kind: "premium", amount: 25_000, currency: "GBP" },
      { kind: "shipping", amount: 4_000, currency: "GBP" },
    ],
  },
  documents: [
    { kind: "invoice", available: true, href: "https://lax.bid/dashboard/payments" },
    { kind: "certificate", available: false, expectedNote: "Sent after payment clears." },
  ],
  actions: [{ kind: "consign", href: "https://lax.bid/dashboard/submissions/new" }],
});

const render = () =>
  renderToStaticMarkup(
    <PortfolioWorkDetail work={buildWorkDetail(work, ["https://cdn.lax.bid"])} />,
  );

describe("PortfolioWorkDetail", () => {
  it("lists each cost line in its currency in a captioned table", () => {
    const html = render();
    expect(html).toContain("<caption");
    for (const text of ["Hammer price", "£1,000.00", "Buyer&#x27;s premium", "Shipping"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("Total, shipping not included");
    expect(html).toContain("£1,250.00");
  });

  it("names the seller business and the product", () => {
    const html = render();
    expect(html).toContain("LAX Bid Ltd");
    expect(html).toContain("LAX Bid");
  });

  it("shows present documents as links and expected ones with their note", () => {
    const html = render();
    expect(html).toContain('href="https://lax.bid/dashboard/payments"');
    expect(html).toContain("Expected. Sent after payment clears.");
  });

  it("deep-links actions into the product", () => {
    const html = render();
    expect(html).toContain('href="https://lax.bid/dashboard/submissions/new"');
    expect(html).toContain("Consign this work");
  });

  it("says there is no valuation yet", () => {
    expect(render()).toContain("No valuation yet.");
  });
});
