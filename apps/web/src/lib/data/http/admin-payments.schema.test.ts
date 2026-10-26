import { describe, expect, it } from "vitest";
import { parseAdminPaymentsListPageBody } from "./admin-payments.schema";

const params = { limit: 50, offset: 0 };
const totals = { totalVolume: "900.00", captured: "800.00", pending: "50.00", refunded: "50.00" };

describe("parseAdminPaymentsListPageBody", () => {
  it("reads the summary's daily volume when the API sends it", () => {
    const volumeTrend = {
      periodDays: 30,
      dailyPence: [0, 5000],
      currentPence: 5000,
      priorPence: 0,
    };
    const page = parseAdminPaymentsListPageBody(
      { data: [], meta: { total: 0, summary: { ...totals, volumeTrend } } },
      params,
    );
    expect(page.summary).toEqual({
      totalVolume: 900,
      captured: 800,
      pending: 50,
      refunded: 50,
      volumeTrend,
    });
  });

  it("drops a malformed or missing trend rather than drawing a wrong one", () => {
    const missing = parseAdminPaymentsListPageBody({ data: [], meta: { summary: totals } }, params);
    expect(missing.summary.volumeTrend).toBeUndefined();
    const broken = parseAdminPaymentsListPageBody(
      { data: [], meta: { summary: { ...totals, volumeTrend: { dailyPence: "x" } } } },
      params,
    );
    expect(broken.summary.volumeTrend).toBeUndefined();
  });
});
