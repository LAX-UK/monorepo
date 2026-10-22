import type { AdminProductionTaskHistoryEntry } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_TASK_STATUSES,
  hasActiveProductionFilters,
  parseProductionQueueQuery,
  productionAssigneeName,
  productionHistorySummary,
  productionQueueApiQuery,
  productionQueueHref,
  productionQueuePageHref,
  productionStatusTone,
  productionTaskSteps,
  productionTaskTitle,
} from "./production-queue.vm";

describe("parseProductionQueueQuery", () => {
  it("reads every filter", () => {
    expect(
      parseProductionQueueQuery({ q: " print ", status: "printing", assignee: "me", cursor: "c" }),
    ).toEqual({ q: "print", status: "printing", assignee: "me", cursor: "c" });
  });

  it("drops unknown statuses and assignees, which are only ever me or unassigned", () => {
    expect(
      parseProductionQueueQuery({ status: "shipped", assignee: "some-subject", q: " " }),
    ).toEqual({});
  });
});

describe("production queue links", () => {
  it("returns to the first page when a filter changes, and clears with null", () => {
    expect(productionQueueHref({ status: "queued", cursor: "c" }, { assignee: "me" })).toBe(
      "/production?status=queued&assignee=me",
    );
    expect(productionQueueHref({ status: "queued" }, { status: null })).toBe("/production");
  });

  it("keeps the filters on the next page link", () => {
    expect(productionQueuePageHref({ assignee: "unassigned" }, "next")).toBe(
      "/production?assignee=unassigned&cursor=next",
    );
  });

  it("passes the URL state to the API as it stands", () => {
    expect(productionQueueApiQuery({ status: "printing", assignee: "me", cursor: "c" })).toEqual({
      status: "printing",
      assignee: "me",
      cursor: "c",
    });
    expect(productionQueueApiQuery({})).toEqual({});
  });

  it("counts filters but not paging", () => {
    expect(hasActiveProductionFilters({ cursor: "c" })).toBe(false);
    expect(hasActiveProductionFilters({ assignee: "me" })).toBe(true);
  });
});

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
  it("marks a failed check as the one state to notice", () => {
    expect(productionStatusTone("qc_failed")).toBe("danger");
    expect(productionStatusTone("completed")).toBe("success");
    expect(productionStatusTone("cancelled")).toBe("neutral");
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
