import { itemSubmissionStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { submissionIsWaiting, submissionQueueSlaDays } from "./submission-sla";
import { buildSubmissionSlaPresentation } from "./submissions/submission-sla-presentation";

const NOW = new Date("2026-10-28T12:00:00Z").getTime();
const THREE_DAYS_AGO = new Date("2026-10-25T12:00:00Z");

describe("submission waiting time", () => {
  it("counts only statuses that wait on someone", () => {
    const waiting = itemSubmissionStatuses.filter((status) => submissionIsWaiting({ status }));
    expect(waiting).toEqual(["submitted", "under_review", "approved"]);
  });

  it("shows no waiting time on a converted submission", () => {
    expect(submissionQueueSlaDays("converted", THREE_DAYS_AGO, NOW)).toBeNull();
    const sla = buildSubmissionSlaPresentation({
      status: "converted",
      updatedAt: THREE_DAYS_AGO,
      now: NOW,
    });
    expect(sla.label).toBeNull();
  });

  it("stops waiting once accepted work has a lot, whatever the status says", () => {
    const sla = buildSubmissionSlaPresentation({
      status: "approved",
      updatedAt: THREE_DAYS_AGO,
      convertedLotId: "lot-1",
      now: NOW,
    });
    expect(sla).toMatchObject({ days: null, label: null });
  });

  it("shows how long work under review has waited", () => {
    const sla = buildSubmissionSlaPresentation({
      status: "under_review",
      updatedAt: THREE_DAYS_AGO,
      now: NOW,
    });
    expect(sla).toMatchObject({ days: 3, label: "3 days waiting" });
  });
});
