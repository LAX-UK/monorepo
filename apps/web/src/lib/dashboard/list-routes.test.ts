import { describe, expect, it } from "vitest";
import { isDashboardListRoute } from "./list-routes";

describe("isDashboardListRoute", () => {
  it("matches primary dashboard list pages", () => {
    expect(isDashboardListRoute("/dashboard/watchlist")).toBe(true);
    expect(isDashboardListRoute("/dashboard/bids")).toBe(true);
    expect(isDashboardListRoute("/dashboard/settings/profile")).toBe(false);
  });
});
