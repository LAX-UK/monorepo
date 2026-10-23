import { buildPortfolioHeader } from "@auction/lax-ecosystem";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { item } from "../server/domain/portfolio-fixtures.test-util";
import { PAID_SO_FAR_NOTE, PortfolioHeader } from "./portfolio-header";

const render = (items: ReturnType<typeof item>[]) =>
  renderToStaticMarkup(<PortfolioHeader header={buildPortfolioHeader(items)} />);

describe("PortfolioHeader", () => {
  it("shows the three counts", () => {
    const html = render([
      item({ id: "1", status: "owned" }),
      item({ id: "2", status: "in_sale" }),
      item({ id: "3", status: "awaiting_payment" }),
    ]);
    expect(html).toContain("Works owned");
    expect(html).toContain("In sale or consigned");
    expect(html).toContain("Awaiting payment");
  });

  it("shows paid so far per currency, side by side, never as one total", () => {
    const html = render([
      item({ id: "1", paid: { lines: [{ kind: "hammer", amount: 1_240_000, currency: "GBP" }] } }),
      item({ id: "2", paid: { lines: [{ kind: "price", amount: 310_000, currency: "EUR" }] } }),
    ]);
    expect(html).toContain("£12,400.00");
    expect(html).toContain("€3,100.00");
    expect(html).not.toContain("£15,500");
  });

  it("states that the figure is not a valuation", () => {
    expect(render([item()])).toContain("in the currency you paid. Not a valuation.");
    expect(PAID_SO_FAR_NOTE).toBe(
      "What you've paid across LAX, in the currency you paid. Not a valuation.",
    );
  });

  it("does not count an unpaid invoice as paid", () => {
    const html = render([
      item({
        status: "awaiting_payment",
        paid: { lines: [{ kind: "hammer", amount: 500_000, currency: "GBP" }] },
      }),
    ]);
    expect(html).toContain("Nothing paid yet");
    expect(html).not.toContain("£5,000");
  });

  it("offers no gain, loss, return or total-value wording", () => {
    const html = render([item()]).toLowerCase();
    for (const word of ["gain", "loss", "return", "total value", "invest"]) {
      expect(html).not.toContain(word);
    }
  });
});
