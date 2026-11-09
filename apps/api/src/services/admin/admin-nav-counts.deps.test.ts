import { describe, expect, it, vi } from "vitest";
import { createAdminNavCountsDeps } from "./admin-nav-counts.deps.js";

function depsAt(now: Date) {
  const countBookedInRange = vi.fn(async () => 3);
  const deps = createAdminNavCountsDeps({
    collectionBookings: { countBookedInRange },
    now: () => now,
  } as unknown as Parameters<typeof createAdminNavCountsDeps>[0]);
  return { deps, countBookedInRange };
}

describe("the Collections count", () => {
  it("counts today's bookings still to hand over, for the London day", async () => {
    const { deps, countBookedInRange } = depsAt(new Date("2026-11-12T09:30:00.000Z"));
    expect(await deps.getCollectionsToHandOver()).toBe(3);
    expect(countBookedInRange).toHaveBeenCalledWith({
      from: new Date("2026-11-12T00:00:00.000Z"),
      to: new Date("2026-11-13T00:00:00.000Z"),
    });
  });

  it("follows British Summer Time: the London day starts an hour before UTC midnight", async () => {
    const { deps, countBookedInRange } = depsAt(new Date("2026-06-12T09:30:00.000Z"));
    await deps.getCollectionsToHandOver();
    expect(countBookedInRange).toHaveBeenCalledWith({
      from: new Date("2026-06-11T23:00:00.000Z"),
      to: new Date("2026-06-12T23:00:00.000Z"),
    });
  });

  it("uses the London day just after midnight there, not the UTC day", async () => {
    const { deps, countBookedInRange } = depsAt(new Date("2026-06-11T23:30:00.000Z"));
    await deps.getCollectionsToHandOver();
    expect(countBookedInRange).toHaveBeenCalledWith({
      from: new Date("2026-06-11T23:00:00.000Z"),
      to: new Date("2026-06-12T23:00:00.000Z"),
    });
  });
});
