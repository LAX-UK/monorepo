import { describe, expect, it, vi } from "vitest";
import { DrizzleLegalEntityMembershipReader } from "./drizzle-legal-entity-membership.reader.js";

describe("DrizzleLegalEntityMembershipReader.listActiveMembershipsForUser", () => {
  it("reads and returns no staff-only field", async () => {
    const select = vi.fn().mockReturnValue({
      from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }),
    });
    await new DrizzleLegalEntityMembershipReader({ select } as never).listActiveMembershipsForUser(
      "u1",
    );
    const columns = Object.keys(select.mock.calls[0]?.[0] ?? {});
    for (const staffOnly of ["statusReason", "statusChangedByUserId", "createdByUserId"]) {
      expect(columns).not.toContain(staffOnly);
    }
  });
});
