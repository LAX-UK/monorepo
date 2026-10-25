import { describe, expect, it, vi } from "vitest";
import { edition, facts, order, sale } from "../../test-support/portfolio-facts.js";
import { createLaxPortfolioHandlers } from "./lax-portfolio.handler.js";

function handlers(flags: { portalOwnershipEnabled: boolean; payoutsEnabled: boolean }) {
  const loadFacts = vi
    .fn()
    .mockResolvedValue(facts({ editions: [edition()], sales: [sale()], orders: [order()] }));
  const built = createLaxPortfolioHandlers({
    reader: { loadFacts },
    flags,
    context: {
      shopOrigin: "https://shop.lax.art",
      artOrigin: "https://lax.art",
      legalName: "London Art Exchange Ltd",
    },
    resolveMediaUrl: (key) => (key ? `https://cdn.lax.art/${key}` : null),
  });
  return { ...built, loadFacts };
}

describe("lax portfolio handlers", () => {
  it("returns a complete response with everything switched on", async () => {
    const { getPortfolio, getMoney, loadFacts } = handlers({
      portalOwnershipEnabled: true,
      payoutsEnabled: true,
    });
    const portfolio = await getPortfolio("subject-1");
    expect(portfolio.partial).toBeUndefined();
    expect(portfolio.items).toHaveLength(2);
    expect(portfolio.items[0]?.image).toBe("https://cdn.lax.art/artworks/quiet-orchard.jpg");
    expect((await getMoney("subject-1")).partial).toBeUndefined();
    expect(loadFacts).toHaveBeenCalledWith("subject-1", { includeSales: true });
  });

  it("returns an empty, partial response without touching the data when ownership is off", async () => {
    const { getPortfolio, getMoney, loadFacts } = handlers({
      portalOwnershipEnabled: false,
      payoutsEnabled: true,
    });
    expect(await getPortfolio("subject-1")).toEqual({ items: [], partial: true });
    expect(await getMoney("subject-1")).toEqual({ entries: [], partial: true });
    expect(loadFacts).not.toHaveBeenCalled();
  });

  it("leaves sales and payouts out, and says so, when payouts are off", async () => {
    const { getPortfolio, getMoney, loadFacts } = handlers({
      portalOwnershipEnabled: true,
      payoutsEnabled: false,
    });
    expect((await getPortfolio("subject-1")).partial).toBe(true);
    expect((await getMoney("subject-1")).partial).toBe(true);
    expect(loadFacts).toHaveBeenCalledWith("subject-1", { includeSales: false });
  });
});
