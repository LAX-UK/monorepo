import type { AdminProductionTaskHistoryEntry } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_TASK_STATUSES,
  productionAssigneeName,
  productionHistorySummary,
  productionTaskSteps,
  productionTaskTitle,
} from "./production-queue.vm";

describe("productionTaskSteps", () => {
  it("offers the usual next step first and keeps cancelling apart", () => {
    const steps = productionTaskSteps("queued");
    expect(steps.forward).toEqual([{ to: "printing", label: "Start printing" }]);
    expect(steps.cancel).toEqual({ to: "cancelled", label: "Cancel task" });
  });

  it("offers a pass and a fail from the quality check", () => {
    expect(productionTaskSteps("qc_pending").forward.map((step) => step.to)).toEqual([
      "qc_passed",
      "qc_failed",
    ]);
  });

  it("calls the move after a failed check a reprint", () => {
    expect(productionTaskSteps("qc_failed").forward).toEqual([
      { to: "printing", label: "Reprint" },
    ]);
  });

  it("offers nothing once a task is finished", () => {
    for (const status of ["completed", "cancelled"] as const) {
      expect(productionTaskSteps(status)).toEqual({ forward: [], cancel: null });
    }
  });

  it("only offers moves the domain allows, for every status", () => {
    for (const status of PRODUCTION_TASK_STATUSES) {
      const { forward, cancel } = productionTaskSteps(status);
      expect(forward.every((step) => step.to !== status)).toBe(true);
      expect(cancel === null || cancel.to === "cancelled").toBe(true);
    }
  });
});

describe("display helpers", () => {
  it("labels every status in words", () => {
    for (const status of PRODUCTION_TASK_STATUSES) {
      expect(PRODUCTION_STATUS_LABELS[status]).not.toContain("_");
    }
    expect(PRODUCTION_STATUS_LABELS.qc_pending).toBe("Awaiting quality check");
  });

  it("titles a task by artwork and edition, falling back to its id", () => {
    expect(
      productionTaskTitle({ artworkTitle: "Dusk", editionNumber: 4, taskId: "abcdef12-0000" }),
    ).toBe("Dusk (edition 4)");
    expect(
      productionTaskTitle({ artworkTitle: null, editionNumber: null, taskId: "abcdef12-0000" }),
    ).toBe("Task abcdef12");
  });

  it("names an unassigned task as such", () => {
    expect(productionAssigneeName(null)).toBe("Unassigned");
    expect(productionAssigneeName({ subject: "s", label: "Pat", role: "operations" })).toBe("Pat");
  });
});

describe("productionHistorySummary", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    at: "2026-03-01T10:00:00.000Z",
    actor: { subject: "s", label: "Pat", role: "operations" },
  };
  const pat = { subject: "p", label: "Pat", role: "operations" };

  it("describes creation, a move, a reassignment and both together", () => {
    const entry = (
      fields: Pick<AdminProductionTaskHistoryEntry, "kind" | "status" | "assignee">,
    ): AdminProductionTaskHistoryEntry => ({ ...base, ...fields });

    expect(productionHistorySummary(entry({ kind: "created", status: null, assignee: null }))).toBe(
      "Task created",
    );
    expect(
      productionHistorySummary(
        entry({
          kind: "updated",
          status: { from: "queued", to: "printing" },
          assignee: null,
        }),
      ),
    ).toBe("Moved from Queued to Printing");
    expect(
      productionHistorySummary(
        entry({ kind: "updated", status: null, assignee: { from: null, to: pat } }),
      ),
    ).toBe("Assigned to Pat");
    expect(
      productionHistorySummary(
        entry({ kind: "updated", status: null, assignee: { from: pat, to: null } }),
      ),
    ).toBe("Unassigned");
    expect(
      productionHistorySummary(
        entry({
          kind: "updated",
          status: { from: "printing", to: "qc_pending" },
          assignee: { from: null, to: pat },
        }),
      ),
    ).toBe("Moved from Printing to Awaiting quality check. Assigned to Pat");
  });
});
