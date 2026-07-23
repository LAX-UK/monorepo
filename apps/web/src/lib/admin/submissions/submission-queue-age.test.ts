import { describe, expect, it } from "vitest";
import {
  formatQueueAgeCompareHint,
  formatSubmissionSlaCountdownDetailed,
} from "./submission-queue-age";

describe("formatQueueAgeCompareHint", () => {
  it("formats singular and plural days waiting without average", () => {
    expect(formatQueueAgeCompareHint(1, null)).toBe("1 day waiting");
    expect(formatQueueAgeCompareHint(3, null)).toBe("3 days waiting");
  });

  it("compares against average wait when available", () => {
    expect(formatQueueAgeCompareHint(5, 3)).toBe("Above avg");
    expect(formatQueueAgeCompareHint(2, 3)).toBe("Below avg");
    expect(formatQueueAgeCompareHint(3, 3)).toBe("At average wait");
  });
});

describe("formatSubmissionSlaCountdownDetailed", () => {
  it("formats days and hours", () => {
    expect(formatSubmissionSlaCountdownDetailed(113)).toBe("4d 17h left");
  });

  it("formats hours only under one day", () => {
    expect(formatSubmissionSlaCountdownDetailed(5)).toBe("5h left");
  });
});
