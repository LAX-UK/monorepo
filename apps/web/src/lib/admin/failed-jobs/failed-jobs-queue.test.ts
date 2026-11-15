import { describe, expect, it } from "vitest";
import { failedJobsDashboardQueues } from "./failed-jobs-queue";

describe("failedJobsDashboardQueues", () => {
  it("links the count to the Needs review list", () => {
    expect(failedJobsDashboardQueues(4)).toEqual([
      {
        id: "failed-jobs-needs-review",
        label: "failed jobs need review",
        count: 4,
        href: "/admin/failed-jobs",
        tone: "warning",
      },
    ]);
  });

  it("pluralises, and drops out at zero", () => {
    expect(failedJobsDashboardQueues(1)[0]?.label).toBe("failed job needs review");
    expect(failedJobsDashboardQueues(0)).toEqual([]);
  });
});
