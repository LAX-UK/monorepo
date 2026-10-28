import type {
  AdminUserListRow,
  IAdminUserActivityReader,
  IAdminUserBidsReader,
  IAdminUserReader,
  IAdminUserSuspender,
} from "@auction/persistence/interfaces";
import { normalizeStaffRoles } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { AuthzError } from "../lib/errors.js";
import { type AdminActor, AdminUserService } from "./admin-user.service.js";
import { StaffRoleAssignmentRefused } from "./staff/staff-role-assignment.service.js";

const REASON = "Repeated chargebacks and a failed identity check.";

const SUPER_ADMIN: AdminActor = { userId: "admin-1", role: "staff", staffRoles: ["administrator"] };
const SUPPORT: AdminActor = {
  userId: "support-1",
  role: "staff",
  staffRoles: ["client_services"],
};

function row(id: string, role: "client" | "staff", staffRole: string | null = null) {
  return { id, role, staffRole } as unknown as AdminUserListRow;
}

function setup(users: AdminUserListRow[] = [row("client-1", "client"), row("client-2", "client")]) {
  const reader = {
    list: vi.fn(),
    getById: vi.fn(async (id: string) => users.find((u) => u.id === id) ?? null),
    getByIds: vi.fn(async (ids: string[]) => users.filter((u) => ids.includes(u.id))),
  } as unknown as IAdminUserReader;
  const roles = { setAccess: vi.fn().mockResolvedValue(undefined) };
  const suspender = {
    suspendMany: vi.fn().mockResolvedValue(undefined),
    unsuspendMany: vi.fn().mockResolvedValue(undefined),
  };
  const invalidate = vi.fn().mockResolvedValue(undefined);
  const service = new AdminUserService(
    reader,
    roles,
    suspender as unknown as IAdminUserSuspender,
    { getRecentSessions: vi.fn() } as unknown as IAdminUserActivityReader,
    { listForUser: vi.fn() } as unknown as IAdminUserBidsReader,
    undefined,
    { invalidate },
  );
  return { service, roles, suspender, invalidate };
}

async function failure(promise: Promise<unknown>): Promise<AuthzError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AuthzError);
    return error as AuthzError;
  }
  throw new Error("expected the call to be refused");
}

describe("AdminUserService suspension", () => {
  it("suspends with the actor and the trimmed reason, then clears the suspension cache", async () => {
    const { service, suspender, invalidate } = setup();

    await service.suspend(SUPPORT, "client-1", `  ${REASON}  `);

    expect(suspender.suspendMany).toHaveBeenCalledWith({
      userIds: ["client-1"],
      reason: REASON,
      actorUserId: "support-1",
      bulk: false,
    });
    expect(invalidate).toHaveBeenCalledWith("client-1");
  });

  it.each([
    ["empty", ""],
    ["blank", "     "],
    ["too short", "spam"],
  ])("refuses a %s reason and suspends nobody", async (_label, reason) => {
    const { service, suspender } = setup();

    const error = await failure(service.suspend(SUPPORT, "client-1", reason));

    expect(error.status).toBe(400);
    expect(error.code).toBe("reason_required");
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });

  it.each(["finance", "read_only", "fulfilment", "saleroom_clerk"])(
    "refuses %s, who may not moderate",
    async (staffRole) => {
      const { service, suspender } = setup();

      const error = await failure(
        service.suspend(
          { userId: "x", role: "staff", staffRoles: normalizeStaffRoles([staffRole]) },
          "client-1",
          REASON,
        ),
      );

      expect(error.status).toBe(403);
      expect(suspender.suspendMany).not.toHaveBeenCalled();
    },
  );

  it("refuses suspending yourself, even as a administrator", async () => {
    const { service, suspender } = setup([row("admin-1", "staff", "administrator")]);

    const error = await failure(service.suspend(SUPER_ADMIN, "admin-1", REASON));

    expect(error.status).toBe(403);
    expect(error.code).toBe("cannot_suspend_self");
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });

  it("refuses suspending a staff account unless the actor is a administrator", async () => {
    const { service, suspender } = setup([row("staff-2", "staff", "sales_manager")]);

    const error = await failure(service.suspend(SUPPORT, "staff-2", REASON));

    expect(error.status).toBe(403);
    expect(error.code).toBe("staff_moderation_requires_administrator");
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });

  it("lets a administrator suspend another staff account", async () => {
    const { service, suspender } = setup([row("staff-2", "staff", "sales_manager")]);

    await service.suspend(SUPER_ADMIN, "staff-2", REASON);

    expect(suspender.suspendMany).toHaveBeenCalledOnce();
  });

  it("answers 404 for an unknown account", async () => {
    const { service, suspender } = setup();

    const error = await failure(service.suspend(SUPPORT, "nobody", REASON));

    expect(error.status).toBe(404);
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });
});

describe("AdminUserService unsuspension", () => {
  it("lifts the suspension with the actor recorded", async () => {
    const { service, suspender, invalidate } = setup();

    await service.unsuspend(SUPPORT, "client-1");

    expect(suspender.unsuspendMany).toHaveBeenCalledWith({
      userIds: ["client-1"],
      actorUserId: "support-1",
      bulk: false,
    });
    expect(invalidate).toHaveBeenCalledWith("client-1");
  });

  it("refuses restoring a staff account unless the actor is a administrator", async () => {
    const { service, suspender } = setup([row("staff-2", "staff", "sales_manager")]);

    const error = await failure(service.unsuspend(SUPPORT, "staff-2"));

    expect(error.status).toBe(403);
    expect(suspender.unsuspendMany).not.toHaveBeenCalled();
  });

  it("refuses a role without the moderation capability", async () => {
    const { service, suspender } = setup();

    const error = await failure(
      service.unsuspend({ userId: "x", role: "staff", staffRoles: ["finance"] }, "client-1"),
    );

    expect(error.status).toBe(403);
    expect(suspender.unsuspendMany).not.toHaveBeenCalled();
  });
});

describe("AdminUserService bulk moderation", () => {
  it("suspends every account in one call, so the batch is atomic, with the actor and reason", async () => {
    const { service, suspender, invalidate } = setup();

    await service.suspendMany(SUPPORT, ["client-1", "client-2", "client-1"], REASON, true);

    expect(suspender.suspendMany).toHaveBeenCalledOnce();
    expect(suspender.suspendMany).toHaveBeenCalledWith({
      userIds: ["client-1", "client-2"],
      reason: REASON,
      actorUserId: "support-1",
      bulk: true,
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it("suspends nobody when the batch includes yourself", async () => {
    const { service, suspender } = setup([
      row("client-1", "client"),
      row("support-1", "staff", "client_services"),
    ]);

    const error = await failure(
      service.suspendMany(superAdminAs("support-1"), ["client-1", "support-1"], REASON, true),
    );

    expect(error.code).toBe("cannot_suspend_self");
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });

  it("suspends nobody when one account in the batch is staff and the actor is not a administrator", async () => {
    const { service, suspender } = setup([
      row("client-1", "client"),
      row("staff-2", "staff", "sales_manager"),
    ]);

    const error = await failure(
      service.suspendMany(SUPPORT, ["client-1", "staff-2"], REASON, true),
    );

    expect(error.status).toBe(403);
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });

  it("suspends nobody when one account in the batch does not exist", async () => {
    const { service, suspender } = setup();

    const error = await failure(service.suspendMany(SUPPORT, ["client-1", "ghost"], REASON, true));

    expect(error.status).toBe(404);
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });

  it("requires a reason for a bulk suspend", async () => {
    const { service, suspender } = setup();

    const error = await failure(service.suspendMany(SUPPORT, ["client-1"], "", true));

    expect(error.code).toBe("reason_required");
    expect(suspender.suspendMany).not.toHaveBeenCalled();
  });

  it("restores a batch in one call", async () => {
    const { service, suspender } = setup();

    await service.unsuspendMany(SUPPORT, ["client-1", "client-2"], true);

    expect(suspender.unsuspendMany).toHaveBeenCalledOnce();
    expect(suspender.unsuspendMany).toHaveBeenCalledWith({
      userIds: ["client-1", "client-2"],
      actorUserId: "support-1",
      bulk: true,
    });
  });
});

function superAdminAs(userId: string): AdminActor {
  return { userId, role: "staff", staffRoles: ["administrator"] };
}

describe("AdminUserService staff roles", () => {
  it("changes another person's staff role and records the actor", async () => {
    const { service, roles } = setup([row("staff-2", "staff", "sales_manager")]);

    await service.setStaffRole("staff", "admin-1", "staff-2", "sales_manager", ["administrator"]);

    expect(roles.setAccess).toHaveBeenCalledWith({
      userId: "staff-2",
      role: "staff",
      staffRoles: ["sales_manager"],
      actorUserId: "admin-1",
      reason: null,
    });
  });

  it("refuses changing your own staff role (self-demotion or escalation)", async () => {
    const { service, roles } = setup([row("admin-1", "staff", "administrator")]);

    const error = await failure(
      service.setStaffRole("staff", "admin-1", "admin-1", "sales_manager", ["administrator"]),
    );

    expect(error.status).toBe(403);
    expect(error.code).toBe("cannot_change_own_role");
    expect(roles.setAccess).not.toHaveBeenCalled();
  });

  it("refuses demoting yourself to a customer through the set-role route", async () => {
    const { service, roles } = setup();

    const error = await failure(
      service.setRole("staff", "admin-1", "admin-1", "client", ["administrator"], null),
    );

    expect(error.message).toBe("Cannot demote yourself");
    expect(roles.setAccess).not.toHaveBeenCalled();
  });

  it("refuses changing your own staff role through the set-role route", async () => {
    const { service, roles } = setup();

    const error = await failure(
      service.setRole("staff", "admin-1", "admin-1", "staff", ["administrator"], "sales_manager"),
    );

    expect(error.code).toBe("cannot_change_own_role");
    expect(roles.setAccess).not.toHaveBeenCalled();
  });

  it("turns the last-administrator guard into a 409", async () => {
    const { service, roles } = setup([row("staff-2", "staff", "administrator")]);
    roles.setAccess.mockRejectedValue(
      new StaffRoleAssignmentRefused("last_administrator", "administrator"),
    );

    const error = await failure(
      service.setStaffRole("staff", "admin-1", "staff-2", "sales_manager", ["administrator"]),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe("last_administrator");
  });

  it("turns the last-administrator guard into a 409 on the set-role route too", async () => {
    const { service, roles } = setup([row("staff-2", "staff", "administrator")]);
    roles.setAccess.mockRejectedValue(
      new StaffRoleAssignmentRefused("last_administrator", "administrator"),
    );

    const error = await failure(
      service.setRole("staff", "admin-1", "staff-2", "client", ["administrator"], null),
    );

    expect(error.status).toBe(409);
  });

  it.each(["client_services", "finance", "sales_manager"])(
    "refuses %s changing anyone's role",
    async (staffRole) => {
      const { service, roles } = setup([row("staff-2", "staff", "sales_manager")]);

      const error = await failure(
        service.setStaffRole(
          "staff",
          "x",
          "staff-2",
          "sales_manager",
          normalizeStaffRoles([staffRole]),
        ),
      );

      expect(error.status).toBe(403);
      expect(roles.setAccess).not.toHaveBeenCalled();
    },
  );

  it("passes non-guard errors through unchanged", async () => {
    const { service, roles } = setup([row("staff-2", "staff", "sales_manager")]);
    roles.setAccess.mockRejectedValue(new Error("db down"));

    await expect(
      service.setStaffRole("staff", "admin-1", "staff-2", "sales_manager", ["administrator"]),
    ).rejects.toThrow("db down");
  });
});
