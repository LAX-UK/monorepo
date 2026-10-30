import { describe, expect, it } from "vitest";
import { memberChangeTarget } from "./member-change-policy.js";
import { memberLeavePolicy } from "./member-leave-policy.js";

const NOW = new Date("2026-10-01");
const owner = { id: "m1", role: "owner" as const, acceptedAt: NOW };
const secondOwner = { id: "m2", role: "owner" as const, acceptedAt: NOW };
const invitedOwner = { id: "m3", role: "owner" as const, acceptedAt: null };
const finance = { id: "m4", role: "finance" as const, acceptedAt: NOW };

const leave = (
  member: typeof owner | typeof finance,
  team: readonly { id: string; role: "owner" | "finance"; acceptedAt: Date | null }[],
  overrides: { isImpersonation?: boolean; accountKind?: "personal" | "organisation" } = {},
) =>
  memberLeavePolicy({
    actor: { role: member.role, isImpersonation: overrides.isImpersonation },
    accountKind: overrides.accountKind ?? "organisation",
    self: memberChangeTarget(member, team),
  });

describe("memberLeavePolicy", () => {
  it("lets any member who is not the last owner leave", () => {
    expect(leave(finance, [owner, finance])).toEqual({ allowed: true });
    expect(leave(owner, [owner, secondOwner, finance])).toEqual({ allowed: true });
  });

  it("refuses the last owner with a reason key: transfer first", () => {
    expect(leave(owner, [owner, finance])).toMatchObject({
      allowed: false,
      reason: "last_owner_must_transfer",
    });
  });

  it("does not count an owner who has not joined yet", () => {
    expect(leave(owner, [owner, invitedOwner])).toMatchObject({
      reason: "last_owner_must_transfer",
    });
  });

  it("refuses support staff viewing as the client, and a personal account", () => {
    expect(leave(finance, [owner, finance], { isImpersonation: true })).toMatchObject({
      reason: "read_only",
    });
    expect(leave(owner, [owner], { accountKind: "personal" })).toMatchObject({
      reason: "personal_account",
    });
  });
});
