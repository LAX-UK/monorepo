import { describe, expect, it } from "vitest";
import { OPEN_DEAL_RECHECK_DAYS, planHeldErasure } from "./data-request-held-erasures.js";

const NOW = new Date("2027-01-01T00:00:00Z");

describe("planHeldErasure", () => {
  it("re-runs a hold with an end date on that date", () => {
    const until = new Date("2031-03-01T00:00:00Z");
    expect(planHeldErasure({ until, withoutEnd: false }, NOW)).toEqual({
      state: "waiting",
      reason: "running",
      heldUntil: until,
      recheckAt: until,
    });
  });

  it("looks again at a hold behind an open deal after the re-check interval", () => {
    const plan = planHeldErasure({ until: null, withoutEnd: false }, NOW);
    expect(plan).toMatchObject({ state: "waiting", reason: "open_deal", heldUntil: null });
    expect(plan.recheckAt?.getTime()).toBe(NOW.getTime() + OPEN_DEAL_RECHECK_DAYS * 86_400_000);
  });

  it("shows staff a hold with no end date, even if another deal has one", () => {
    const until = new Date("2031-03-01T00:00:00Z");
    expect(planHeldErasure({ until, withoutEnd: true }, NOW).state).toBe("needs_staff");
    expect(planHeldErasure({ until: null, withoutEnd: true }, NOW)).toEqual({
      state: "needs_staff",
      reason: "end_unknown",
      heldUntil: null,
      recheckAt: null,
    });
  });

  it("shows staff a hold whose end was not reported", () => {
    expect(planHeldErasure(undefined, NOW).state).toBe("needs_staff");
  });
});
