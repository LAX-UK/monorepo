import type { AdminUserRow } from "@/lib/data/http/admin-users.types";
import type { AdminInvitationSummary } from "@/lib/data/http/invitations.shared";
import { describe, expect, it } from "vitest";
import { clientsSort, peopleRangeSummary, toClientsStaffRows } from "./clients-staff-list.vm";
import { invitationsSort, toInvitationStaffRows } from "./invitations-staff-list.vm";
import { toStaffDirectoryRows } from "./staff-directory-list.vm";

const user = (over: Partial<AdminUserRow> = {}): AdminUserRow => ({
  id: "user_1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  role: "client",
  staffRole: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
  suspendedAt: null,
  image: null,
  mobile: null,
  mobileCountry: null,
  emailVerified: true,
  emailStatus: "ok",
  signupPersona: null,
  twoFactorEnabled: false,
  kycStatus: "unverified",
  kycVerifiedAt: null,
  kycRetryCount: 0,
  deletionRequestedAt: null,
  ...over,
});

describe("people list rows", () => {
  it("reads identity and standing as words, never raw values", () => {
    const [row] = toClientsStaffRows([user({ suspendedAt: "2026-10-02T09:00:00.000Z" })], "/x");
    expect(row?.identity.label).toBe("Not verified");
    expect(row?.account).toEqual({ label: "Suspended", tone: "danger" });
    expect(row?.persona).toBe("Not set");
  });

  it("names a staff member's role and the LAX tools they use", () => {
    const [row] = toStaffDirectoryRows(
      [user({ role: "staff", staffRole: "finance" })],
      {
        user_1: {
          platforms: [{ product: "bid", role: "finance" }],
          twoFactorEnabled: true,
          lastSignInAt: "2026-10-24T08:00:00.000Z",
        },
      },
      "/admin/staff",
    );
    expect(row?.staffRoleLabel).not.toMatch(/_/);
    expect(row?.access.length).toBe(1);
    expect(row?.twoFactor).toBe(true);
  });

  it("explains why an accepted invitation cannot be revoked", () => {
    const invitation: AdminInvitationSummary = {
      id: "inv_1",
      email: "new@example.com",
      targetRole: "client",
      targetStaffRole: null,
      grants: [],
      status: "accepted",
      expiresAt: new Date("2026-10-30T09:00:00.000Z"),
      createdAt: new Date("2026-10-23T09:00:00.000Z"),
      openedAt: null,
      inviteEmailLastStatus: "delivered",
      invitedByName: "Sam Staff",
    };
    const [row] = toInvitationStaffRows([invitation]);
    expect(row?.status.label).toBe("Accepted");
    expect(row?.revokeBlocked).toBe("Already accepted");
    expect(row?.delivery).toBe("Delivered");
  });

  it("shows a default sort and keeps the URL clean for it", () => {
    expect(clientsSort.state(undefined)).toEqual({ columnId: "joined", direction: "desc" });
    expect(invitationsSort.param({ columnId: "sent", direction: "desc" })).toBeNull();
    expect(invitationsSort.param({ columnId: "expires", direction: "asc" })).toBe("expires_asc");
  });

  it("summarises the page range", () => {
    expect(peopleRangeSummary(50, 12, 62, { one: "client", other: "clients" })).toBe(
      "51–62 of 62 clients",
    );
  });
});
