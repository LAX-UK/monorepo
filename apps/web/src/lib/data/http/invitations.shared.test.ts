import { describe, expect, it } from "vitest";
import {
  EMPTY_ADMIN_INVITATIONS_LIST_SUMMARY,
  parseAdminInvitationsPageBody,
} from "./invitations.shared";

describe("parseAdminInvitationsPageBody", () => {
  it("parses standard list envelope with meta.summary", () => {
    const page = parseAdminInvitationsPageBody(
      {
        data: [
          {
            id: "inv-1",
            email: "alice@example.com",
            targetRole: "staff",
            targetStaffRole: "super_admin",
            status: "pending",
            expiresAt: "2026-08-01T00:00:00.000Z",
            createdAt: "2026-07-01T00:00:00.000Z",
            openedAt: null,
            inviteEmailLastStatus: null,
            invitedByName: "Admin User",
          },
        ],
        meta: {
          total: 1,
          limit: 50,
          offset: 0,
          summary: {
            total: 5,
            pending: 3,
            accepted: 2,
          },
        },
      },
      { limit: 50, offset: 0 },
    );

    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.email).toBe("alice@example.com");
    expect(page.total).toBe(1);
    expect(page.summary).toEqual({ total: 5, pending: 3, accepted: 2 });
    expect(page.pendingTotal).toBe(3);
    expect(page.acceptedTotal).toBe(2);
    expect(page.hasNextPage).toBe(false);
  });

  it("throws when summary is missing or invalid", () => {
    expect(() =>
      parseAdminInvitationsPageBody(
        {
          data: [],
          meta: { total: 0, limit: 50, offset: 0 },
        },
        { limit: 50, offset: 0 },
      ),
    ).toThrow("Invalid invitations list summary in API response");
  });

  it("throws when total is missing", () => {
    expect(() =>
      parseAdminInvitationsPageBody(
        {
          data: [],
          meta: {
            limit: 50,
            offset: 0,
            summary: EMPTY_ADMIN_INVITATIONS_LIST_SUMMARY,
          },
        },
        { limit: 50, offset: 0 },
      ),
    ).toThrow("Invalid invitations list total in API response");
  });
});
