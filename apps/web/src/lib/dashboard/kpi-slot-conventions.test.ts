import { kpiCompareHint } from "@/lib/dashboard/kpi-slot-conventions";
import { describe, expect, it } from "vitest";

describe("kpiCompareHint", () => {
  it("returns a compareHint slot for KPI tiles", () => {
    expect(kpiCompareHint("3 shown")).toEqual({ compareHint: "3 shown" });
  });
});
