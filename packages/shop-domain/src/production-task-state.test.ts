import { describe, expect, it } from "vitest";
import {
  SHOP_PRODUCTION_TASK_STATUSES,
  type ShopProductionTaskStatus,
  canTransitionProductionTask,
  productionTaskNextSteps,
} from "./production-task-state.js";

const ALLOWED: Record<ShopProductionTaskStatus, readonly ShopProductionTaskStatus[]> = {
  queued: ["printing", "cancelled"],
  printing: ["qc_pending", "cancelled"],
  qc_pending: ["qc_passed", "qc_failed", "cancelled"],
  qc_failed: ["printing", "cancelled"],
  qc_passed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

describe("production task transitions", () => {
  it.each(
    SHOP_PRODUCTION_TASK_STATUSES.flatMap((from) =>
      SHOP_PRODUCTION_TASK_STATUSES.map((to) => [from, to] as const),
    ),
  )("%s -> %s", (from, to) => {
    expect(canTransitionProductionTask(from, to)).toBe(ALLOWED[from].includes(to));
  });

  it("lists the forward step first, so a UI can offer it as the primary action", () => {
    expect(productionTaskNextSteps("queued")[0]).toBe("printing");
    expect(productionTaskNextSteps("qc_failed")[0]).toBe("printing");
    expect(productionTaskNextSteps("qc_passed")[0]).toBe("completed");
  });

  it("has no way out of completed or cancelled", () => {
    expect(productionTaskNextSteps("completed")).toEqual([]);
    expect(productionTaskNextSteps("cancelled")).toEqual([]);
  });
});
