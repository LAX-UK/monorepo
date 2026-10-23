import { describe, expect, it } from "vitest";
import { item } from "./portfolio-fixtures.test-util";
import { buildPortfolioSummary } from "./portfolio-summary.vm";

const composed = (
  rows: ReturnType<typeof item>[],
  overrides: { complete?: boolean; unavailable?: ("bid" | "shop")[] } = {},
) => ({ rows, complete: true, unavailable: [], ...overrides });

describe("buildPortfolioSummary", () => {
  it("counts works by state and leaves zeros out", () => {
    const summary = buildPortfolioSummary(
      composed([
        item({ id: "1", status: "owned" }),
        item({ id: "2", status: "owned" }),
        item({ id: "3", status: "awaiting_payment" }),
      ]),
    );
    expect(summary).toEqual({
      kind: "counts",
      counts: ["2 works owned", "1 awaiting payment"],
      incompleteNote: null,
    });
  });

  it("falls back to a plain count when no work is in a counted state", () => {
    const summary = buildPortfolioSummary(composed([item({ status: "payout_paid" })]));
    expect(summary).toMatchObject({ kind: "counts", counts: ["1 work"] });
  });

  it("flags the counts as possibly low when one product did not answer", () => {
    const summary = buildPortfolioSummary(
      composed([item()], { complete: false, unavailable: ["bid"] }),
    );
    expect(summary).toMatchObject({
      kind: "counts",
      incompleteNote: "Some products did not answer, so these counts may be low.",
    });
  });

  it("welcomes a new collector only when every product answered", () => {
    expect(buildPortfolioSummary(composed([]))).toEqual({ kind: "empty" });
    expect(buildPortfolioSummary(composed([], { complete: false, unavailable: ["bid"] }))).toEqual({
      kind: "unavailable",
    });
  });

  it("is unavailable when every product failed", () => {
    expect(
      buildPortfolioSummary(composed([], { complete: false, unavailable: ["bid", "shop"] })),
    ).toEqual({ kind: "unavailable" });
  });
});
