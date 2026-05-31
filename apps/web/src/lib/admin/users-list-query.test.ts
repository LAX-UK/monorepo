import { describe, expect, it } from "vitest";
import {
  countUsersListActiveFilters,
  parseUsersListFilters,
  usersListFiltersToApiParams,
} from "./users-list-query";

describe("users-list-query", () => {
  it("parses filters from search params", () => {
    const f = parseUsersListFilters({
      emailVerified: "1",
      kycStatus: "approved",
      status: "active",
    });
    expect(f.emailVerified).toBe(true);
    expect(f.kycStatus).toBe("approved");
    expect(f.accountStatus).toBe("active");
    expect(countUsersListActiveFilters(f)).toBeGreaterThan(0);
  });

  it("maps filters to API params", () => {
    const qs = usersListFiltersToApiParams(
      { emailVerified: false, sort: "name_asc" },
      { limit: 25, offset: 0 },
    );
    expect(qs.emailVerified).toBe("0");
    expect(qs.sort).toBe("name_asc");
  });
});
