import { describe, expect, it } from "vitest";
import type { getAdminHomeKpiTrends } from "./admin-kpi-trends.server";

describe("getAdminHomeKpiTrends", () => {
  it("exports capability-aware options type", () => {
    type Options = NonNullable<Parameters<typeof getAdminHomeKpiTrends>[1]>;
    const opts: Options = { includeSubmissions: true, includePayments: false };
    expect(opts.includeSubmissions).toBe(true);
  });
});
