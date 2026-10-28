import type { StaffRoleAssignmentRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { StaffRoleAssignmentRefused } from "./staff-role-assignment.service.js";
import { StaffRolesAdminService } from "./staff-roles-admin.service.js";

const NOW = new Date("2026-10-28T12:00:00Z");

function assignment(overrides: Partial<StaffRoleAssignmentRecord> = {}): StaffRoleAssignmentRecord {
  return {
    id: "asg-1",
    userId: "ada",
    role: "finance",
    startsAt: new Date("2026-10-01T09:00:00Z"),
    endsAt: null,
    grantedByUserId: "admin-1",
    grantedAt: new Date("2026-10-01T09:00:00Z"),
    reason: "Joined the finance team",
    ...overrides,
  };
}

function setup(role: "staff" | "client" = "staff") {
  const changes = { assign: vi.fn().mockResolvedValue(undefined), remove: vi.fn() };
  const roles = {
    listCurrent: vi.fn().mockResolvedValue([assignment()]),
    listActiveRoles: vi.fn(),
    countOtherActiveAdministrators: vi.fn().mockResolvedValue(2),
  };
  const users = { getById: vi.fn().mockResolvedValue({ id: "ada", role }) };
  const review = {
    listStaff: vi.fn().mockResolvedValue([
      {
        userId: "ada",
        name: "Ada",
        email: "ada@lax.test",
        suspended: false,
        assignments: [assignment()],
      },
      { userId: "bo", name: null, email: "bo@lax.test", suspended: true, assignments: [] },
    ]),
  };
  const identity = {
    readSecuritySummaries: vi
      .fn()
      .mockResolvedValue(
        new Map([
          ["ada", { twoFactorEnabled: true, lastSignInAt: new Date("2026-10-27T08:00:00Z") }],
        ]),
      ),
  };
  const svc = new StaffRolesAdminService({
    changes,
    roles,
    // biome-ignore lint/suspicious/noExplicitAny: the fake returns only the fields read.
    users: users as any,
    review,
    // biome-ignore lint/suspicious/noExplicitAny: the fake returns only the fields read.
    identity: identity as any,
    clock: () => NOW,
  });
  return { svc, changes, roles, users, review, identity };
}

describe("StaffRolesAdminService.overview", () => {
  it("lists the person's roles with how many other administrators there are", async () => {
    const { svc, roles } = setup();
    const result = await svc.overview("ada");
    expect(result._unsafeUnwrap()).toEqual({
      userId: "ada",
      otherActiveAdministrators: 2,
      assignments: [
        {
          id: "asg-1",
          role: "finance",
          startsAt: "2026-10-01T09:00:00.000Z",
          endsAt: null,
          grantedAt: "2026-10-01T09:00:00.000Z",
          reason: "Joined the finance team",
        },
      ],
    });
    expect(roles.listCurrent).toHaveBeenCalledWith("ada", NOW);
  });

  it("does not treat a client as staff", async () => {
    const { svc } = setup("client");
    expect((await svc.overview("ada"))._unsafeUnwrapErr().status).toBe(404);
  });
});

describe("StaffRolesAdminService changes", () => {
  it("gives a role through the roster", async () => {
    const { svc, changes } = setup();
    const input = {
      userId: "ada",
      actorUserId: "admin-1",
      role: "fulfilment" as const,
      endsAt: new Date("2026-12-01T00:00:00Z"),
      reason: "Cover for the winter sale",
    };
    expect((await svc.assign(input)).isOk()).toBe(true);
    expect(changes.assign).toHaveBeenCalledWith(input);
  });

  it("explains a refused combination with the rule's code", async () => {
    const { svc, changes } = setup();
    changes.assign.mockRejectedValue(
      new StaffRoleAssignmentRefused("forbidden_combination", "compliance", "finance"),
    );
    const result = await svc.assign({
      userId: "ada",
      actorUserId: "admin-1",
      role: "compliance",
      reason: "Needed",
    });
    expect(result._unsafeUnwrapErr()).toEqual({
      status: 409,
      code: "forbidden_combination",
      message:
        "Compliance can't be combined with Finance. Moving money and clearing compliance checks are kept with different people.",
    });
  });

  it("refuses to remove the last administrator", async () => {
    const { svc, changes } = setup();
    changes.remove.mockRejectedValue(
      new StaffRoleAssignmentRefused("last_administrator", "administrator"),
    );
    const result = await svc.remove({
      userId: "ada",
      actorUserId: "admin-1",
      role: "administrator",
      reason: "Leaving",
    });
    expect(result._unsafeUnwrapErr()).toMatchObject({ status: 409, code: "last_administrator" });
  });

  it("lets other failures surface", async () => {
    const { svc, changes } = setup();
    changes.remove.mockRejectedValue(new Error("database down"));
    await expect(
      svc.remove({ userId: "ada", actorUserId: "admin-1", role: "finance", reason: "Gone" }),
    ).rejects.toThrow("database down");
  });
});

describe("StaffRolesAdminService.accessReview", () => {
  it("lists every staff member with their roles and last sign-in", async () => {
    const { svc } = setup();
    const rows = await svc.accessReview();
    expect(rows.map((row) => [row.userId, row.lastSignInAt, row.roles.length])).toEqual([
      ["ada", "2026-10-27T08:00:00.000Z", 1],
      ["bo", null, 0],
    ]);
    expect(rows[1]?.suspended).toBe(true);
  });

  it("shows sign-ins as unknown when identity cannot say", async () => {
    const { svc, identity } = setup();
    identity.readSecuritySummaries.mockRejectedValue(new Error("identity down"));
    const rows = await svc.accessReview();
    expect(rows.every((row) => row.lastSignInAt === null)).toBe(true);
  });
});
