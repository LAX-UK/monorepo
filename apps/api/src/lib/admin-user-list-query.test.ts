import { describe, expect, it } from "vitest";
import { mapAdminUserListQuery } from "./admin-user-list-query.js";

describe("mapAdminUserListQuery", () => {
  it("maps tri-state and date ranges", () => {
    const filter = mapAdminUserListQuery({
      limit: 25,
      offset: 0,
      sort: "created_desc",
      emailVerified: "1",
      twoFactor: "0",
      createdFrom: "2026-01-01",
      createdTo: "2026-01-31",
      kycStatuses: ["approved", "pending"],
    });

    expect(filter.emailVerified).toBe(true);
    expect(filter.twoFactorEnabled).toBe(false);
    expect(filter.kycStatuses).toEqual(["approved", "pending"]);
    expect(filter.createdFrom?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(filter.createdToExclusive?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("prefers status over legacy suspended flag", () => {
    const filter = mapAdminUserListQuery({
      limit: 10,
      offset: 0,
      sort: "name_asc",
      status: "suspended",
    });
    expect(filter.accountStatus).toBe("suspended");
    expect(filter.suspendedOnly).toBeUndefined();
  });
});
