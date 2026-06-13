import { describe, expect, it } from "vitest";
import { adminLotsKpiTrendQuerySchema } from "./admin-kpi.js";

describe("adminLotsKpiTrendQuerySchema", () => {
  it("defaults periodDays to 30", () => {
    expect(adminLotsKpiTrendQuerySchema.parse({})).toEqual({ periodDays: 30 });
  });

  it("accepts 7, 30, and 90", () => {
    expect(adminLotsKpiTrendQuerySchema.parse({ periodDays: "7" }).periodDays).toBe(7);
    expect(adminLotsKpiTrendQuerySchema.parse({ periodDays: "90" }).periodDays).toBe(90);
  });
});
