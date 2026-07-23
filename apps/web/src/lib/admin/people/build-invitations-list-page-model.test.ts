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
    });
    expect(model.hasFilters).toBe(true);
    expect(model.activeFilterCount).toBe(2);
    expect(model.buildPaginationHref({ offset: 0 })).toContain("offset=0");
  });
});
