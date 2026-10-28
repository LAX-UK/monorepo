import type { ConsumeInviteResult } from "@auction/persistence/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type IInvitationAcceptanceUnitOfWork,
  InvitationConsumptionService,
  bidAccessFromInvite,
} from "./invitation-consumption.service.js";
import { StaffRoleAssignmentRefused } from "./staff/staff-role-assignment.service.js";

type Accepted = Extract<ConsumeInviteResult, { outcome: "ok" }>;

function accepted(overrides: Partial<Accepted> = {}): Accepted {
  return {
    outcome: "ok",
    invitationId: "inv-1",
    invitedByUserId: "admin-1",
    targetRole: "staff",
    targetStaffRole: "specialist",
    grants: [{ product: "bid", role: "specialist" }],
    ...overrides,
  };
}

function setup() {
  const invites = { findPendingByTokenHash: vi.fn(), updateStatus: vi.fn() };
  const accept = vi.fn<(...args: unknown[]) => Promise<ConsumeInviteResult>>();
  const setAccess = vi.fn().mockResolvedValue(undefined);
  const committed: string[] = [];
  const acceptance: IInvitationAcceptanceUnitOfWork = {
    run: async (work) => {
      const result = await work({ invitations: { accept }, staffAccess: { setAccess } });
      committed.push("commit");
      return result;
    },
  };
  return {
    svc: new InvitationConsumptionService(invites, acceptance),
    invites,
    accept,
    setAccess,
    committed,
  };
}

describe("bidAccessFromInvite", () => {
  it("makes the person staff with the Bid grant's role", () => {
    expect(bidAccessFromInvite(accepted(), "existing_user")).toEqual({
      role: "staff",
      staffRoles: ["specialist"],
    });
  });

  it("gives a new account the invitation's base role and leaves an existing one alone", () => {
    const shopOnly = accepted({
      targetRole: "client",
      targetStaffRole: null,
      grants: [{ product: "shop", role: "broker" }],
    });
    expect(bidAccessFromInvite(shopOnly, "new_user")).toEqual({ role: "client", staffRoles: [] });
    expect(bidAccessFromInvite(shopOnly, "existing_user")).toBeNull();
  });
});

describe("InvitationConsumptionService.consumeInviteForNewUser", () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it("applies the invitation's Bid roles through the staff roster in the same unit of work", async () => {
    s.accept.mockResolvedValue(accepted());
    const res = await s.svc.consumeInviteForNewUser("tok", "user-1", "a@example.com");
    expect(res.isOk() && res.value).toBe("staff");
    expect(s.setAccess).toHaveBeenCalledWith({
      userId: "user-1",
      role: "staff",
      staffRoles: ["specialist"],
      actorUserId: "admin-1",
      reason: "Accepted staff invitation",
      invitationId: "inv-1",
    });
  });

  it.each([
    ["expired", "Invitation expired"],
    ["email_mismatch", "Email does not match invitation"],
    ["invalid", "Invalid invitation"],
  ] as const)("maps %s to a 400 error and changes no roles", async (outcome, message) => {
    s.accept.mockResolvedValue({ outcome });
    const res = await s.svc.consumeInviteForNewUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error).toEqual({ message, status: 400 });
    expect(s.setAccess).not.toHaveBeenCalled();
  });

  it("refuses with 409 and keeps the invitation when the roster refuses the role", async () => {
    s.accept.mockResolvedValue(accepted());
    s.setAccess.mockRejectedValue(
      new StaffRoleAssignmentRefused("last_administrator", "administrator"),
    );
    const res = await s.svc.consumeInviteForNewUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.status).toBe(409);
    expect(s.committed).toEqual([]);
  });
});

describe("InvitationConsumptionService.acceptForExistingUser", () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
  });

  it("returns the grants and leaves Bid access alone without a Bid grant", async () => {
    s.invites.findPendingByTokenHash.mockResolvedValue({ targetLegalEntityId: null });
    s.accept.mockResolvedValue(
      accepted({
        targetRole: "client",
        targetStaffRole: null,
        grants: [{ product: "shop", role: "broker" }],
      }),
    );
    const res = await s.svc.acceptForExistingUser("tok", "user-1", "a@example.com");
    expect(res.isOk() && res.value.grants).toEqual([{ product: "shop", role: "broker" }]);
    expect(s.setAccess).not.toHaveBeenCalled();
  });

  it("refuses organisation invitations, which have their own accept flow", async () => {
    s.invites.findPendingByTokenHash.mockResolvedValue({ targetLegalEntityId: "le-1" });
    const res = await s.svc.acceptForExistingUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.message).toBe("Invalid invitation");
    expect(s.accept).not.toHaveBeenCalled();
  });

  it("maps email mismatch from the locked accept", async () => {
    s.invites.findPendingByTokenHash.mockResolvedValue(null);
    s.accept.mockResolvedValue({ outcome: "email_mismatch" });
    const res = await s.svc.acceptForExistingUser("tok", "user-1", "a@example.com");
    expect(res.isErr() && res.error.message).toBe("Email does not match invitation");
  });
});
