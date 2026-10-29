import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type MemberChange,
  type MemberChangeDenial,
  authorisationRevocationFor,
  countOwners,
  memberChangeConfirmationPhrase,
  memberChangePolicy,
  memberChangeTarget,
} from "./member-change-policy.js";

const ME = "member-me";
const OTHER = "member-other";

type Outcome = "allow" | "allow+confirm" | MemberChangeDenial;

function decide(
  role: LegalEntityMemberRole,
  change: MemberChange,
  isImpersonation = false,
): Outcome {
  const decision = memberChangePolicy(
    { role, isImpersonation, memberId: isImpersonation ? null : ME },
    change,
  );
  if (!decision.allowed) return decision.reason;
  return decision.confirmation ? "allow+confirm" : "allow";
}

const target = (role: LegalEntityMemberRole, memberId = OTHER, isLastOwner = false) => ({
  memberId,
  role,
  isLastOwner,
});
const lastOwner = () => target("owner", OTHER, true);

/** The changes an owner or admin can attempt, each about a colleague with every role. */
function everyChange(memberId = OTHER): { label: string; change: MemberChange }[] {
  return legalEntityMemberRoles.flatMap((role) => [
    { label: `invite as ${role}`, change: { action: "invite", newRole: role } as MemberChange },
    ...legalEntityMemberRoles.map((newRole) => ({
      label: `change ${role} to ${newRole}`,
      change: { action: "change_role", target: target(role, memberId), newRole } as MemberChange,
    })),
    { label: `remove ${role}`, change: { action: "remove", target: target(role, memberId) } },
    {
      label: `transfer ownership to ${role}`,
      change: { action: "transfer_ownership", target: target(role, memberId) },
    },
  ]);
}

/**
 * What an admin may do, written out per change. Admins run the team but never touch the owner
 * role; removing another admin is confirmed by typing.
 */
function expectedForAdmin(change: MemberChange): Outcome {
  switch (change.action) {
    case "invite":
      return change.newRole === "owner" ? "owner_only" : "allow";
    case "change_role":
      return change.target.role === "owner" || change.newRole === "owner" ? "owner_only" : "allow";
    case "remove":
      if (change.target.role === "owner") return "owner_only";
      return change.target.role === "admin" ? "allow+confirm" : "allow";
    case "transfer_ownership":
      return "owner_only";
  }
}

/** What an owner may do while another owner remains. */
function expectedForOwner(change: MemberChange): Outcome {
  switch (change.action) {
    case "invite":
    case "change_role":
      return "allow";
    case "remove":
      return change.target.role === "owner" || change.target.role === "admin"
        ? "allow+confirm"
        : "allow";
    case "transfer_ownership":
      return "allow+confirm";
  }
}

describe("memberChangePolicy", () => {
  describe.each(["finance", "consignor", "viewer", "buyer_agent"] as const)("a %s", (role) => {
    it.each(everyChange())("cannot $label", ({ change }) => {
      expect(decide(role, change)).toBe("cannot_manage_members");
    });
  });

  describe("an admin", () => {
    it.each(everyChange())("$label", ({ change }) => {
      expect(decide("admin", change)).toBe(expectedForAdmin(change));
    });
  });

  describe("an owner, while another owner remains", () => {
    it.each(everyChange())("$label", ({ change }) => {
      expect(decide("owner", change)).toBe(expectedForOwner(change));
    });
  });

  describe("the last owner", () => {
    it.each(legalEntityMemberRoles.filter((r) => r !== "owner"))(
      "cannot be made a %s",
      (newRole) => {
        expect(decide("owner", { action: "change_role", target: lastOwner(), newRole })).toBe(
          "last_owner",
        );
      },
    );

    it("cannot be removed", () => {
      expect(decide("owner", { action: "remove", target: lastOwner() })).toBe("last_owner");
    });

    it("can hand ownership over, since the new owner takes the role", () => {
      expect(decide("owner", { action: "transfer_ownership", target: target("admin") })).toBe(
        "allow+confirm",
      );
    });

    it("can keep the owner role unchanged", () => {
      expect(
        decide("owner", { action: "change_role", target: lastOwner(), newRole: "owner" }),
      ).toBe("allow");
    });
  });

  describe.each(["owner", "admin"] as const)("an %s acting on themselves", (role) => {
    it.each(everyChange(ME).filter(({ change }) => change.action !== "invite"))(
      "cannot $label",
      ({ change }) => {
        expect(decide(role, change)).toBe("self");
      },
    );
  });

  describe("support staff viewing as the client", () => {
    it.each(everyChange())("cannot $label", ({ change }) => {
      expect(decide("admin", change, true)).toBe("read_only");
    });
  });

  it("explains every refusal in words", () => {
    const decision = memberChangePolicy(
      { role: "admin", memberId: ME },
      { action: "invite", newRole: "owner" },
    );
    expect(decision).toEqual({
      allowed: false,
      reason: "owner_only",
      message: "Only an owner can grant, change or remove the owner role.",
    });
  });
});

describe("memberChangeTarget", () => {
  const owner = { id: "a", role: "owner" as const, acceptedAt: new Date() };
  const otherOwner = { id: "b", role: "owner" as const, acceptedAt: new Date() };
  const invitedOwner = { id: "c", role: "owner" as const, acceptedAt: null };

  it("marks the only accepted owner as the last one", () => {
    expect(memberChangeTarget(owner, [owner, invitedOwner]).isLastOwner).toBe(true);
    expect(memberChangeTarget(owner, [owner, otherOwner]).isLastOwner).toBe(false);
  });

  it("never marks someone who has not accepted, or is not an owner", () => {
    expect(memberChangeTarget(invitedOwner, [owner, invitedOwner]).isLastOwner).toBe(false);
    const admin = { id: "d", role: "admin" as const, acceptedAt: new Date() };
    expect(memberChangeTarget(admin, [owner, admin]).isLastOwner).toBe(false);
  });
});

describe("countOwners", () => {
  it("counts accepted owners only", () => {
    expect(
      countOwners([
        { role: "owner", acceptedAt: new Date() },
        { role: "owner", acceptedAt: null },
        { role: "admin", acceptedAt: new Date() },
      ]),
    ).toBe(1);
  });
});

describe("memberChangeConfirmationPhrase", () => {
  it("names the member", () => {
    expect(memberChangeConfirmationPhrase("remove", "Lena Fischer")).toBe("REMOVE Lena Fischer");
    expect(memberChangeConfirmationPhrase("transfer_ownership", "Lena Fischer")).toBe(
      "TRANSFER PRIMARY TO Lena Fischer",
    );
  });
});

describe("authorisationRevocationFor", () => {
  it("ends authorisations when a member is removed", () => {
    expect(authorisationRevocationFor({ action: "remove", target: target("buyer_agent") })).toBe(
      "member_removed",
    );
  });

  it.each(legalEntityMemberRoles.filter((r) => r !== "buyer_agent"))(
    "ends them when a buyer agent becomes %s",
    (newRole) => {
      expect(
        authorisationRevocationFor({
          action: "change_role",
          target: target("buyer_agent"),
          newRole,
        }),
      ).toBe("role_changed");
    },
  );

  it("keeps them when the role stays buyer agent, and for invitations", () => {
    expect(
      authorisationRevocationFor({
        action: "change_role",
        target: target("buyer_agent"),
        newRole: "buyer_agent",
      }),
    ).toBeNull();
    expect(authorisationRevocationFor({ action: "invite", newRole: "buyer_agent" })).toBeNull();
  });

  it("ends them when a buyer agent is handed ownership", () => {
    expect(
      authorisationRevocationFor({ action: "transfer_ownership", target: target("buyer_agent") }),
    ).toBe("role_changed");
  });
});
