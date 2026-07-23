import { describe, expect, it } from "vitest";
import { buildSubmissionSlaCountdownPresentation } from "./submission-sla-countdown-presentation";

describe("buildSubmissionSlaCountdownPresentation", () => {
  it("returns null for terminal statuses", () => {
    expect(
      buildSubmissionSlaCountdownPresentation({
        status: "rejected",
        updatedAt: new Date("2026-06-10T12:00:00Z"),
        isOverSla: false,
        now: new Date("2026-06-12T12:00:00Z").getTime(),
      }),
    ).toEqual({ label: null, tone: null });
  });

  it("formats detailed countdown for active queue items", () => {
    const updatedAt = new Date("2026-06-10T12:00:00Z");
    const now = new Date("2026-06-17T06:00:00Z").getTime();
    const result = buildSubmissionSlaCountdownPresentation({
      status: "under_review",
      updatedAt,
      isOverSla: false,
      now,
    });
    expect(result.label).toBe("6h left");
    expect(result.tone).toBe("warning");
  });
});
