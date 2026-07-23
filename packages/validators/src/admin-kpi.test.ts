import { describe, expect, it } from "vitest";
import { adminKpiTrendQuerySchema } from "./admin-kpi.js";

describe("adminKpiTrendQuerySchema", () => {
  it("defaults periodDays to 30", () => {
    expect(adminKpiTrendQuerySchema.parse({})).toEqual({ periodDays: 30 });
  });

  it("accepts 7, 30, and 90", () => {
    expect(adminKpiTrendQuerySchema.parse({ periodDays: "7" }).periodDays).toBe(7);
    expect(adminKpiTrendQuerySchema.parse({ periodDays: "90" }).periodDays).toBe(90);
  });

  it("rejects invalid periodDays", () => {
    expect(() => adminKpiTrendQuerySchema.parse({ periodDays: "14" })).toThrow();
  });
});
