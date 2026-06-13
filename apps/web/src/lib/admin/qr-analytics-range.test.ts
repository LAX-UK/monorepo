import { describe, expect, it } from "vitest";
import { customDateRangeToAnalyticsQuery } from "./qr-analytics-range";

describe("customDateRangeToAnalyticsQuery", () => {
  it("maps auction-zone calendar dates to a half-open UTC instant range", () => {
    const query = customDateRangeToAnalyticsQuery({
      from: "2026-06-01",
      to: "2026-06-03",
    });
    if (!("from" in query)) throw new Error("expected custom range query");

    // Europe/London is on BST (UTC+1) in June.
    expect(query.from).toBe("2026-05-31T23:00:00.000Z");
    expect(query.to).toBe("2026-06-03T23:00:00.000Z");
  });
});
