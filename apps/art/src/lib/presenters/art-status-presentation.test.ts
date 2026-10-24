import { describe, expect, it } from "vitest";
import { resolveEditionAvailabilityPresentation } from "./art-status-presentation.js";

describe("art status presentation", () => {
  it("maps edition availability to Available or Sold out only", () => {
    expect(resolveEditionAvailabilityPresentation("available")).toEqual({
      label: "Available",
      tone: "success",
    });
    expect(resolveEditionAvailabilityPresentation("sold_out")).toEqual({
      label: "Sold out",
      tone: "neutral",
    });
  });
});
