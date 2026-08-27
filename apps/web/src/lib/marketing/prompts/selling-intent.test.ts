import { describe, expect, it } from "vitest";
import { resolveSellingIntentTrigger } from "./selling-intent";

describe("resolveSellingIntentTrigger", () => {
  it.each([
    ["/sell", "", "sell-content"],
    ["/sell/watches", "", "sell-content"],
    ["/search", "?intent=sell", "sell-query"],
    ["/", "?utm_campaign=summer_consignment", "sell-query"],
    ["/search", "?intent=buy", null],
  ] as const)("resolves %s%s", (pathname, search, expected) => {
    expect(resolveSellingIntentTrigger({ pathname, search })).toBe(expected);
  });
});
