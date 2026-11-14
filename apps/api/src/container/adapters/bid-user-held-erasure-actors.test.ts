import { NO_STAFF_ROLES } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import type { BidUserContext } from "../../services/interfaces/bid-user-context.js";
import { BidUserHeldErasureActors } from "./bid-user-held-erasure-actors.js";

const context = (over: Partial<BidUserContext> = {}): BidUserContext => ({
  role: "staff",
  staffRoles: ["administrator"],
  suspendedAt: null,
  identityDisabledAt: null,
  mergedIntoSubjectId: null,
  ...over,
});

function actorsFor(found: BidUserContext | null) {
  return new BidUserHeldErasureActors({ loadContext: vi.fn(async () => found) });
}

describe("BidUserHeldErasureActors", () => {
  it("allows staff who still hold the Data requests capability", async () => {
    expect(await actorsFor(context()).canManageDataRequests("staff-1")).toBe(true);
  });

  it("refuses an account that is gone", async () => {
    expect(await actorsFor(null).canManageDataRequests("staff-1")).toBe(false);
  });

  it("refuses staff who lost the capability, and people who are not staff", async () => {
    expect(
      await actorsFor(context({ staffRoles: NO_STAFF_ROLES })).canManageDataRequests("staff-1"),
    ).toBe(false);
    expect(
      await actorsFor(
        context({ role: "client", staffRoles: NO_STAFF_ROLES }),
      ).canManageDataRequests("staff-1"),
    ).toBe(false);
  });

  it.each([
    ["suspended", { suspendedAt: new Date() }],
    ["disabled", { identityDisabledAt: new Date() }],
    ["merged away", { mergedIntoSubjectId: "other" }],
  ])("refuses an account that is %s", async (_label, over) => {
    expect(await actorsFor(context(over)).canManageDataRequests("staff-1")).toBe(false);
  });
});
