import { describe, expect, it } from "vitest";
import { nextSteps, replyByLabel } from "./enquiry-sent";

describe("replyByLabel", () => {
  it("reads the day the reply is due as a person in London does", () => {
    expect(replyByLabel("2026-11-04T10:30:00.000Z")).toBe("Wednesday 4 November");
  });

  it("uses the London day, not the UTC one, late in the evening in summer", () => {
    expect(replyByLabel("2026-07-28T23:30:00.000Z")).toBe("Wednesday 29 July");
  });
});

describe("nextSteps", () => {
  const by = "Wednesday 4 November";

  it("tells a seller who reads it, what may be asked and that terms come before any buyer", () => {
    const steps = nextSteps("sell", { departmentLabel: "Paintings", replyBy: by });
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({
      lead: "A paintings specialist reads it",
      rest: " and replies within two business days, by Wednesday 4 November.",
    });
    expect(steps[1]?.lead).toBe("They may ask for more photos");
    expect(steps[2]?.lead).toBe("If you go ahead,");
  });

  it("tells a buyer the same three things in a buyer's terms", () => {
    const steps = nextSteps("buy", { replyBy: by });
    expect(steps).toHaveLength(3);
    expect(steps[0]?.lead).toBe("A specialist reads it");
    expect(steps[0]?.rest).toContain("by Wednesday 4 November");
  });

  it("falls back to a plain specialist when the department is not known", () => {
    expect(nextSteps("sell", { replyBy: by })[0]?.lead).toBe("A specialist reads it");
  });
});
