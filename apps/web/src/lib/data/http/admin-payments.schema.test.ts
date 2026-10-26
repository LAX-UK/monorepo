import { describe, expect, it } from "vitest";
import { parseAdminPaymentsListPageBody } from "./admin-payments.schema";

const params = { limit: 50, offset: 0 };
const totals = { totalVolume: "900.00", captured: "800.00", pending: "50.00", refunded: "50.00" };
const trend = { dailyPence: [0, 5000], currentPence: 5000, priorPence: 0 };

describe("parseAdminPaymentsListPageBody", () => {
  it("reads the summary's daily series when the API sends them", () => {
    const trends = {
      periodDays: 30,
      volume: trend,
      captured: trend,
      refunded: trend,
      awaiting: trend,
    };
    const page = parseAdminPaymentsListPageBody(
      { data: [], meta: { total: 0, summary: { ...totals, trends } } },
      params,
    );
    expect(page.summary).toEqual({
      totalVolume: 900,
      captured: 800,
      pending: 50,
      refunded: 50,
      trends,
    });
  });

  it("drops malformed or missing series rather than drawing wrong ones", () => {
    const missing = parseAdminPaymentsListPageBody({ data: [], meta: { summary: totals } }, params);
    expect(missing.summary.trends).toBeUndefined();
    const broken = parseAdminPaymentsListPageBody(
      { data: [], meta: { summary: { ...totals, trends: { periodDays: 30, volume: trend } } } },
      params,
    );
    expect(broken.summary.trends).toBeUndefined();
  });
});
