import { describe, expect, it } from "vitest";
import { SUMMARY } from "./data-request.fixture";
import { dataRequestsDashboardQueues } from "./data-requests-queue";

describe("dataRequestsDashboardQueues", () => {
  it("leads with what is overdue, then what is due within 7 days, each linking to its view", () => {
    expect(dataRequestsDashboardQueues(SUMMARY)).toEqual([
      {
        id: "data-requests-overdue",
        label: "data request is overdue",
        count: 1,
        href: "/admin/compliance/data-requests?view=overdue",
        tone: "danger",
      },
      {
        id: "data-requests-due-soon",
        label: "data request is due within 7 days",
        count: 1,
        href: "/admin/compliance/data-requests",
        tone: "warning",
      },
    ]);
  });

  it("pluralises, and drops a line at zero", () => {
    const lines = dataRequestsDashboardQueues({ ...SUMMARY, overdue: 3, dueSoon: 0 });
    expect(lines.map((line) => line.label)).toEqual(["data requests are overdue"]);
    expect(dataRequestsDashboardQueues({ ...SUMMARY, overdue: 0, dueSoon: 0 })).toEqual([]);
  });
});
