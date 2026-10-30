import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import type { MemberRow, PendingInvitationRow } from "./member-management.actions";
import { invitationRowViews, memberRowViews } from "./member-row.vm";

function member(id: string, role: LegalEntityMemberRole, name: string): MemberRow {
  return {
    id,
    legalEntityId: "org",
    userId: `user-${id}`,
    role,
    isPrimaryAdmin: false,
    invitedAt: null,
    acceptedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    user: { id: `user-${id}`, email: `${id}@northbank.test`, name, image: null },
  };
}

const owner = member("owner", "owner", "Ada Owner");
const admin = member("admin", "admin", "Sam Admin");
const lena = member("lena", "finance", "Lena Fischer");
const agent = member("agent", "buyer_agent", "Ravi Agent");
const team = [owner, admin, lena, agent];

const viewAs = (self: MemberRow) => (rowId: string) => {
  const rows = memberRowViews({ actor: { role: self.role, memberId: self.id }, members: team });
  const row = rows.find((r) => r.id === rowId);
  if (!row) throw new Error(`no row ${rowId}`);
  return row;
};

describe("memberRowViews, seen by an owner", () => {
  const row = viewAs(owner);

  it("offers every role for a colleague, the current one first, in words", () => {
    expect(row("lena").roleOptions?.map((o) => o.label)).toEqual([
      "Finance",
      "Owner",
      "Admin",
      "Consignor",
      "Buyer agent",
      "Viewer",
    ]);
  });

  it("offers Transfer ownership and Remove on colleagues", () => {
    expect(row("lena").transfer).toEqual({ confirmPhrase: "Transfer to Lena Fischer" });
    expect(row("lena").canRemove).toBe(true);
  });

  it("shows the owner's own row as read-only and marks it as theirs", () => {
    expect(row("owner")).toMatchObject({
      isYou: true,
      roleOptions: null,
      transfer: null,
      canRemove: false,
      roleLabel: "Owner",
    });
  });
});

describe("memberRowViews, seen by an admin", () => {
  const row = viewAs(admin);

  it("never offers the owner role or Transfer ownership", () => {
    const labels = row("lena").roleOptions?.map((o) => o.label);
    expect(labels).not.toContain("Owner");
    expect(labels?.[0]).toBe("Finance");
    expect(row("lena").transfer).toBeNull();
    expect(row("lena").canRemove).toBe(true);
  });

  it("leaves the owner's row alone", () => {
    expect(row("owner")).toMatchObject({ roleOptions: null, transfer: null, canRemove: false });
  });
});

describe.each(["finance", "consignor", "viewer", "buyer_agent"] as const)(
  "memberRowViews, seen by a %s",
  (role) => {
    it("offers no picker and no menu items on any row", () => {
      const self = member("me", role, "Me");
      const rows = memberRowViews({
        actor: { role, memberId: self.id },
        members: [...team, self],
      });
      for (const row of rows) {
        expect(row).toMatchObject({ roleOptions: null, transfer: null, canRemove: false });
      }
    });
  },
);

describe("memberRowViews two-step sign-in", () => {
  it("shows it as words only to people given it", () => {
    const actor = { role: "owner" as const, memberId: owner.id };
    const rows = memberRowViews({
      actor,
      members: team,
      twoFactorByUserId: { "user-owner": true, "user-lena": false },
    });
    expect(rows.map((r) => r.twoStep)).toEqual([
      "Two-step on",
      null,
      "Two-step off",
      null,
    ]);
    expect(memberRowViews({ actor, members: team }).every((r) => r.twoStep === null)).toBe(true);
  });
});

describe("memberRowViews order", () => {
  it("lists you first, then by role from owners to viewers, then by name", () => {
    const viewerB = member("vb", "viewer", "Beth Viewer");
    const viewerA = member("va", "viewer", "Anna Viewer");
    const consignor = member("c", "consignor", "Cara Consignor");
    const rows = memberRowViews({
      actor: { role: "admin", memberId: admin.id },
      members: [viewerB, consignor, agent, lena, viewerA, owner, admin],
    });
    expect(rows.map((r) => r.name)).toEqual([
      "Sam Admin",
      "Ada Owner",
      "Lena Fischer",
      "Cara Consignor",
      "Ravi Agent",
      "Anna Viewer",
      "Beth Viewer",
    ]);
  });
});

describe("invitationRowViews", () => {
  const invitation = (role: LegalEntityMemberRole, expiresAt: string): PendingInvitationRow => ({
    id: `inv-${role}`,
    email: `${role}@example.com`,
    role,
    sentAt: "2026-10-29T10:00:00Z",
    expiresAt,
  });
  const now = new Date("2026-11-01T12:00:00Z");

  it("states the role, when it was sent and when it expires", () => {
    const [row] = invitationRowViews(
      { role: "admin", memberId: "admin" },
      [invitation("finance", "2026-11-05T10:00:00Z")],
      now,
    );
    expect(row).toMatchObject({
      detail: ["Finance · Sent 29 Oct 2026", "Expires 5 Nov 2026"],
      expired: false,
      canManage: true,
    });
  });

  it("says when an invitation has run out", () => {
    const [row] = invitationRowViews(
      { role: "owner", memberId: "owner" },
      [invitation("viewer", "2026-10-31T10:00:00Z")],
      now,
    );
    expect(row?.detail).toEqual(["Viewer · Sent 29 Oct 2026", "Expired 31 Oct 2026"]);
    expect(row?.expired).toBe(true);
  });

  it("leaves owner invitations to owners", () => {
    const rows = [invitation("owner", "2026-11-05T10:00:00Z")];
    expect(invitationRowViews({ role: "admin", memberId: "a" }, rows, now)[0]?.canManage).toBe(
      false,
    );
    expect(invitationRowViews({ role: "owner", memberId: "o" }, rows, now)[0]?.canManage).toBe(
      true,
    );
  });
});
