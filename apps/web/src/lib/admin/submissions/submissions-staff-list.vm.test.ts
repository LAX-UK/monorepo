import type { AdminSubmissionTableRow } from "@/lib/admin/catalog/submission-table-row";
import { EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY } from "@/lib/data/http/admin-submissions-summary.server";
import { describe, expect, it } from "vitest";
import {
  bulkSubmissionOperationIds,
  submissionPanelHref,
  submissionPanelId,
  submissionsAttention,
  submissionsFilterChips,
  submissionsMetrics,
  submissionsRangeSummary,
  submissionsSortHref,
  submissionsSortState,
  submissionsTeamViews,
  submissionsViews,
  toSubmissionsStaffRows,
} from "./submissions-staff-list.vm";

const row: AdminSubmissionTableRow = {
  id: "sub_1",
  title: "Harbour at dusk",
  thumbnailUrl: null,
  categoryPreview: "Paintings · Oil on canvas",
  sellerPreview: "Hartley Fine Art",
  status: "under_review",
  createdAtIso: "2026-10-12T09:00:00.000Z",
  createdAtLabel: "",
  slaDays: 9,
  slaLabel: "9 days waiting",
  slaTone: "red",
  isOverSla: true,
  qualityWarnings: [],
  qualityGaps: [
    {
      id: "provenance",
      label: "No provenance",
      description: "Add provenance.",
      severity: "warning",
    },
    {
      id: "dimensions",
      label: "Missing dimensions",
      description: "Add the dimensions.",
      severity: "required",
    },
  ],
  qualitySummaryLabel: "Missing dimensions",
  blocksAccept: true,
  assigneeLabel: "You",
  assigneeUserId: "user_1",
  isAssignedToCurrentUser: true,
  isUnassigned: false,
};

describe("submissions staff list view model", () => {
  it("names the status, the wait and what is missing, required first", () => {
    const [submission] = toSubmissionsStaffRows([row]);
    expect(submission?.status).toEqual({ label: "Under review", tone: "warning" });
    expect(submission?.waiting).toEqual({ label: "9 days waiting", tone: "danger" });
    expect(submission?.quality).toEqual({ label: "Missing dimensions", tone: "danger" });
    expect(submission?.gaps.map((gap) => gap.id)).toEqual(["dimensions", "provenance"]);
    expect(submission?.assignee).toBe("You");
    expect(submission?.decisionHref).toBe("/admin/submissions/sub_1/decision");
  });

  it("shows no assignee for an unassigned submission", () => {
    const [submission] = toSubmissionsStaffRows([{ ...row, isUnassigned: true }]);
    expect(submission?.assignee).toBeNull();
  });

  it("offers bulk accept only when every chosen submission is under review and complete", () => {
    expect(bulkSubmissionOperationIds([])).toEqual([]);
    expect(
      bulkSubmissionOperationIds([{ statusCode: "under_review", blocksAccept: false }]),
    ).toEqual(["approve", "reject"]);
    expect(
      bulkSubmissionOperationIds([
        { statusCode: "under_review", blocksAccept: false },
        { statusCode: "under_review", blocksAccept: true },
      ]),
    ).toEqual(["reject"]);
    expect(
      bulkSubmissionOperationIds([
        { statusCode: "under_review", blocksAccept: false },
        { statusCode: "submitted", blocksAccept: false },
      ]),
    ).toEqual([]);
  });

  it("opens the panel from the URL, including the older preview links", () => {
    expect(submissionPanelId({ submission: "sub_1" })).toBe("sub_1");
    expect(submissionPanelId({ preview: "sub_2" })).toBe("sub_2");
    expect(submissionPanelHref({ queue: "accepted", preview: "x" }, "sub_1")).toBe(
      "/admin/submissions?queue=accepted&submission=sub_1",
    );
  });

  it("maps the oldest-waiting order to the waiting column and back", () => {
    expect(submissionsSortState("sla")).toEqual({ columnId: "waiting", direction: "desc" });
    expect(submissionsSortState(undefined).columnId).toBe("submitted");
    expect(submissionsSortHref({}, { columnId: "waiting", direction: "desc" })).toBe(
      "/admin/submissions?sort=sla",
    );
  });

  it("counts each queue in its tab and links the waiting work", () => {
    const summary = {
      ...EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY,
      overSla: 1,
      assignedToMe: 3,
      queueCounts: { awaiting: 12, accepted: 4, rejected: 2 },
    };
    const [awaiting, accepted] = submissionsViews({}, summary);
    expect(awaiting?.count).toBe(12);
    expect(awaiting?.href).toBe("/admin/submissions");
    expect(accepted?.href).toBe("/admin/submissions?queue=accepted");
    const [over, mine] = submissionsAttention({}, summary);
    expect(over?.label).toBe("submission has waited more than 7 days");
    expect(mine?.href).toBe("/admin/submissions?assignedTo=me");
  });

  it("says when nothing is waiting instead of an empty average", () => {
    const metrics = submissionsMetrics(EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY);
    expect(metrics.find((metric) => metric.id === "age")?.value).toBe("None waiting");
    expect(
      submissionsMetrics({ ...EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY, avgQueueAgeDays: 1.2 }).find(
        (metric) => metric.id === "age",
      )?.value,
    ).toBe("1 day");
  });

  it("keeps search and sort out of the chips, and words the flags plainly", () => {
    const chips = submissionsFilterChips([
      { id: "q", label: "Search: harbour", clearHref: "/a" },
      { id: "sort", label: "Sort", clearHref: "/b" },
      { id: "qualityGaps", label: "Quality gaps only", clearHref: "/c" },
    ]);
    expect(chips).toEqual([{ id: "qualityGaps", label: "Missing details only", clearHref: "/c" }]);
  });

  it("summarises the range shown", () => {
    expect(submissionsRangeSummary(50, 25, 75)).toBe("51–75 of 75 submissions");
  });
});

describe("submissionsTeamViews", () => {
  it("offers the desk's shared views as list queries", () => {
    const views = submissionsTeamViews();
    expect(views.map((view) => view.label)).toEqual([
      "Waiting longest",
      "Assigned to me",
      "Missing details",
    ]);
    expect(views[0]).toMatchObject({ query: "sort=sla", href: "/admin/submissions?sort=sla" });
    expect(views.every((view) => view.id.startsWith("team-"))).toBe(true);
  });
});
