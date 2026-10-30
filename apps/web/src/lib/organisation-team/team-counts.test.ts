import { describe, expect, it } from "vitest";
import { teamTabCounts } from "./team-counts";

const now = new Date("2026-10-30T12:00:00Z");

describe("teamTabCounts", () => {
  it("counts people, waiting invitations and authorisations in force", () => {
    expect(
      teamTabCounts({
        members: 5,
        invitations: [{ expiresAt: "2026-11-05T00:00:00Z" }, { expiresAt: "2026-10-29T00:00:00Z" }],
        authorisations: 3,
        now,
      }),
    ).toEqual({ members: 5, invitations: 1, bidding: 3 });
  });

  it("leaves off a count that could not be read instead of showing 0", () => {
    expect(teamTabCounts({ members: null, invitations: null, authorisations: 0, now })).toEqual({
      bidding: 0,
    });
  });
});
