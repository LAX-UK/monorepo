import { describe, expect, it } from "vitest";
import { resolveEditionAvailabilityPresentation } from "./art-status-presentation.js";

describe("art status presentation", () => {
  it("derives edition availability", () => {
    expect(
      resolveEditionAvailabilityPresentation({ editionsAvailable: 0, totalEditions: 10 }).tone,
    ).toBe("neutral");
    expect(
      resolveEditionAvailabilityPresentation({ editionsAvailable: 1, totalEditions: 10 }).tone,
    ).toBe("warning");
    expect(
      resolveEditionAvailabilityPresentation({ editionsAvailable: 5, totalEditions: 10 }).tone,
    ).toBe("success");
  });
});
