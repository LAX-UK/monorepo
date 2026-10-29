import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type MemberForControls,
  inviteRoleOptions,
  memberRowControls,
  memberViewOnlyReason,
} from "./member-controls.vm";

const member = (id: string, role: LegalEntityMemberRole, accepted = true): MemberForControls => ({
  id,
  role,
  acceptedAt: accepted ? "2026-01-01T00:00:00Z" : null,
  user: { name: `Name ${id}` },
});

const owner = member("owner", "owner");
const admin = member("admin", "admin");
const agent = member("agent", "buyer_agent");
const invited = member("invited", "viewer", false);
const team = [owner, admin, agent, invited];

const actorAs = (self: MemberForControls) => ({ role: self.role, memberId: self.id });

describe("memberRowControls", () => {
  it("shows an admin no controls on the owner, and none on themselves", () => {
    const none = { roleOptions: [], remove: null, transfer: null };
    expect(memberRowControls(actorAs(admin), owner, team)).toEqual(none);
    expect(memberRowControls(actorAs(admin), admin, team)).toEqual(none);
  });

  it("offers an admin every role but owner for others, and plain removal", () => {
    const controls = memberRowControls(actorAs(admin), agent, team);
    expect(controls.roleOptions).toEqual([
      "buyer_agent",
      "admin",
      "consignor",
      "finance",
      "viewer",
    ]);
    expect(controls.remove).toEqual({ confirmPhrase: null });
    expect(controls.transfer).toBeNull();
  });

  it("offers an owner the owner role, typed removal of an admin and the transfer", () => {
    const controls = memberRowControls(actorAs(owner), admin, team);
    expect(controls.roleOptions).toContain("owner");
    expect(controls.remove).toEqual({ confirmPhrase: "REMOVE Name admin" });
    expect(controls.transfer).toEqual({ confirmPhrase: "TRANSFER PRIMARY TO Name admin" });
  });

  it("never offers ownership to someone who has not joined", () => {
    expect(memberRowControls(actorAs(owner), invited, team).transfer).toBeNull();
  });

  it("shows support staff viewing as the client no controls", () => {
    const staff = { role: "admin" as const, isImpersonation: true, memberId: null };
    expect(memberRowControls(staff, agent, team)).toEqual({
      roleOptions: [],
      remove: null,
      transfer: null,
    });
  });
});

describe("inviteRoleOptions", () => {
  it("lets only owners invite owners", () => {
    expect(inviteRoleOptions(actorAs(owner))).toContain("owner");
    expect(inviteRoleOptions(actorAs(admin))).not.toContain("owner");
    expect(inviteRoleOptions(actorAs(admin))).toHaveLength(5);
  });
});

describe("memberViewOnlyReason", () => {
  it("is empty for people who can make changes", () => {
    expect(memberViewOnlyReason(actorAs(admin))).toBeNull();
  });

  it("explains why support staff can only look", () => {
    expect(memberViewOnlyReason({ role: "admin", isImpersonation: true, memberId: null })).toBe(
      "You're viewing this organisation as LAX support, so changes are turned off.",
    );
  });
});
