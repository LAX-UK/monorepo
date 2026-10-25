import { buildInvitationsListPageModel } from "@/lib/admin/people/build-invitations-list-page-model";
import { describe, expect, it } from "vitest";

describe("buildInvitationsListPageModel", () => {
  it("preserves filters and pagination params", () => {
    const model = buildInvitationsListPageModel({
      status: "pending",
      q: "alice",
      offset: "25",
      limit: "50",
      invitation: "inv-123",
    });

    expect(model.selectedInvitationId).toBe("inv-123");
    expect(model.listReturnTarget).toContain("/admin/invitations");

    expect(model.listQueryParams).toEqual({
      limit: 50,
      offset: 25,
      status: "pending",
      q: "alice",
      sort: "created_desc",
    });
    expect(model.hasFilters).toBe(true);
    expect(model.activeFilterCount).toBe(2);
    expect(model.buildPaginationHref({ offset: 0 })).toContain("offset=0");
  });

  it("carries a valid sort and does not count it as a filter", () => {
    const model = buildInvitationsListPageModel({ sort: "expires_asc" });
    expect(model.listQueryParams.sort).toBe("expires_asc");
    expect(model.query.sort).toBe("expires_asc");
    expect(model.hasFilters).toBe(false);
    expect(model.activeFilterCount).toBe(0);
    expect(model.activeFilterChips).toEqual([]);
  });

  it("falls back to newest first for an unknown sort", () => {
    expect(buildInvitationsListPageModel({ sort: "name_asc" }).listQueryParams.sort).toBe(
      "created_desc",
    );
    expect(buildInvitationsListPageModel({}).listQueryParams.sort).toBe("created_desc");
  });
});
