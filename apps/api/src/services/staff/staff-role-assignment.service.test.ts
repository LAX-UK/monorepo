import type {
  IStaffRoster,
  IStaffRosterTransaction,
  StaffProfileRoles,
  StaffRoleAssignmentRecord,
  StaffRosterEvent,
} from "@auction/persistence/interfaces";
import { ADMINISTRATOR_STAFF_ROLE, activeStaffRoles, primaryStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  StaffRoleAssignmentRefused,
  StaffRoleAssignmentService,
} from "./staff-role-assignment.service.js";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const EARLIER = new Date("2026-01-01T00:00:00.000Z");
const ACTOR = "admin-1";

/** In-memory roster: a change commits only when the whole unit of work succeeds. */
class FakeRoster implements IStaffRoster {
  assignments: StaffRoleAssignmentRecord[] = [];
  profiles = new Map<string, StaffProfileRoles>();
  events: StaffRosterEvent[] = [];
  suspended = new Set<string>();
  private nextId = 1;

  hold(userId: string, role: StaffRoleAssignmentRecord["role"], endsAt: Date | null = null) {
    this.assignments.push({
      id: `a${this.nextId++}`,
      userId,
      role,
      startsAt: EARLIER,
      endsAt,
      grantedByUserId: null,
      grantedAt: EARLIER,
      reason: "migrated from single role",
    });
    this.profiles.set(userId, {
      role: "staff",
      primaryStaffRole: primaryStaffRole(activeStaffRoles(this.current(userId, NOW), NOW)),
    });
  }

  current(userId: string, now: Date) {
    return this.assignments.filter(
      (a) => a.userId === userId && (a.endsAt === null || a.endsAt > now),
    );
  }

  async listCurrent(userId: string, now: Date) {
    return this.current(userId, now).map((a) => ({ ...a }));
  }

  async listActiveRoles(userId: string, now: Date) {
    return activeStaffRoles(this.current(userId, now), now);
  }

  async transact<T>(work: (tx: IStaffRosterTransaction) => Promise<T>): Promise<T> {
    const snapshot = {
      assignments: this.assignments.map((a) => ({ ...a })),
      profiles: new Map(this.profiles),
      events: [...this.events],
    };
    const tx: IStaffRosterTransaction = {
      listCurrent: (userId, now) => this.listCurrent(userId, now),
      countOtherActiveAdministrators: async (userId, now) =>
        new Set(
          this.assignments
            .filter(
              (a) =>
                a.userId !== userId &&
                !this.suspended.has(a.userId) &&
                a.role === ADMINISTRATOR_STAFF_ROLE &&
                activeStaffRoles([a], now).length > 0,
            )
            .map((a) => a.userId),
        ).size,
      insert: async (input) => {
        const record = {
          ...input,
          id: `a${this.nextId++}`,
          grantedAt: NOW,
        };
        this.assignments.push(record);
        return { ...record };
      },
      end: async (id, endsAt) => {
        this.assignments = this.assignments.map((a) => (a.id === id ? { ...a, endsAt } : a));
      },
      writeProfileRoles: async (userId, next) => {
        const previous = this.profiles.get(userId) ?? null;
        this.profiles.set(userId, next);
        return previous;
      },
      recordEvents: async (events) => {
        this.events.push(...events);
      },
    };
    try {
      return await work(tx);
    } catch (error) {
      this.assignments = snapshot.assignments;
      this.profiles = snapshot.profiles;
      this.events = snapshot.events;
      throw error;
    }
  }
}

function setup() {
  const roster = new FakeRoster();
  const service = new StaffRoleAssignmentService(roster, () => NOW);
  return { roster, service };
}

async function refusal(promise: Promise<unknown>): Promise<StaffRoleAssignmentRefused> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(StaffRoleAssignmentRefused);
    return error as StaffRoleAssignmentRefused;
  }
  throw new Error("expected the change to be refused");
}

describe("StaffRoleAssignmentService.assign", () => {
  it("adds a second role, keeps the first as the role shown and audits the grant", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "specialist");

    await service.assign({
      userId: "u1",
      role: "client_services",
      actorUserId: ACTOR,
      reason: "Cover",
    });

    expect(await roster.listActiveRoles("u1", NOW)).toEqual(["specialist", "client_services"]);
    expect(roster.profiles.get("u1")).toEqual({ role: "staff", primaryStaffRole: "specialist" });
    expect(roster.events).toEqual([
      {
        type: "staff.role_assigned",
        userId: "u1",
        actorUserId: ACTOR,
        payload: {
          assignmentId: expect.any(String),
          role: "client_services",
          startsAt: NOW.toISOString(),
          endsAt: null,
          reason: "Cover",
        },
      },
    ]);
    const granted = roster.assignments.find((a) => a.role === "client_services");
    expect(granted).toMatchObject({ grantedByUserId: ACTOR, reason: "Cover", endsAt: null });
  });

  it("stores an end date and stops counting the role once it passes", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "specialist");
    const endsAt = new Date("2026-11-01T00:00:00.000Z");

    await service.assign({
      userId: "u1",
      role: "cataloguer",
      actorUserId: ACTOR,
      reason: null,
      endsAt,
    });

    expect(await roster.listActiveRoles("u1", NOW)).toContain("cataloguer");
    expect(await roster.listActiveRoles("u1", endsAt)).toEqual(["specialist"]);
  });

  it.each([
    ["specialist", "specialist", "duplicate"],
    ["finance", "compliance", "forbidden_combination"],
    ["administrator", "specialist", "forbidden_combination"],
    ["read_only", "client_services", "forbidden_combination"],
  ] as const)("holding %s, refuses %s (%s) and writes nothing", async (held, requested, reason) => {
    const { roster, service } = setup();
    roster.hold("u1", held);
    roster.hold("other-admin", "administrator");
    const before = roster.assignments.length;

    const error = await refusal(
      service.assign({ userId: "u1", role: requested, actorUserId: ACTOR, reason: null }),
    );

    expect(error.reason).toBe(reason);
    expect(roster.assignments).toHaveLength(before);
    expect(roster.events).toEqual([]);
  });
});

describe("StaffRoleAssignmentService.remove", () => {
  it("ends the assignment, keeps it as history and audits the removal", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "specialist");
    roster.hold("u1", "client_services");

    await service.remove({
      userId: "u1",
      role: "specialist",
      actorUserId: ACTOR,
      reason: "Moved team",
    });

    expect(await roster.listActiveRoles("u1", NOW)).toEqual(["client_services"]);
    expect(roster.assignments.find((a) => a.role === "specialist")?.endsAt).toEqual(NOW);
    expect(roster.profiles.get("u1")).toEqual({
      role: "staff",
      primaryStaffRole: "client_services",
    });
    expect(roster.events.map((e) => e.type)).toEqual([
      "staff.role_removed",
      "lax.staff_access.granted",
    ]);
  });

  it("never removes the last active administrator", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "administrator");
    roster.hold("suspended-admin", "administrator");
    roster.suspended.add("suspended-admin");

    const error = await refusal(
      service.remove({ userId: "u1", role: "administrator", actorUserId: ACTOR, reason: null }),
    );

    expect(error.reason).toBe("last_administrator");
    expect(await roster.listActiveRoles("u1", NOW)).toEqual(["administrator"]);
  });

  it("refuses removing a role the person does not hold", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "specialist");

    const error = await refusal(
      service.remove({ userId: "u1", role: "sales_manager", actorUserId: ACTOR, reason: null }),
    );

    expect(error.reason).toBe("not_assigned");
  });
});

describe("StaffRoleAssignmentService.setAccess (existing role-change paths)", () => {
  it("swaps one role for another: removes first so the new role never combines with it", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "administrator");
    roster.hold("u2", "administrator");

    await service.setAccess({
      userId: "u1",
      role: "staff",
      staffRoles: ["sales_manager"],
      actorUserId: ACTOR,
      reason: null,
    });

    expect(await roster.listActiveRoles("u1", NOW)).toEqual(["sales_manager"]);
    expect(roster.profiles.get("u1")).toEqual({
      role: "staff",
      primaryStaffRole: "sales_manager",
    });
    expect(roster.events.map((e) => e.type)).toEqual([
      "staff.role_removed",
      "staff.role_assigned",
      "lax.staff_access.granted",
    ]);
  });

  it("makes a staff member a client with no roles and records the revoked access", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "specialist");

    await service.setAccess({
      userId: "u1",
      role: "client",
      staffRoles: [],
      actorUserId: ACTOR,
      reason: null,
    });

    expect(await roster.listActiveRoles("u1", NOW)).toEqual([]);
    expect(roster.profiles.get("u1")).toEqual({ role: "client", primaryStaffRole: null });
    expect(roster.events.at(-1)).toEqual({
      type: "lax.staff_access.revoked",
      payload: { schemaVersion: 1, subjectId: "u1", product: "bid", revokedBySubjectId: ACTOR },
    });
  });

  it("is a no-op for the roles already held", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "specialist");

    await service.setAccess({
      userId: "u1",
      role: "staff",
      staffRoles: ["specialist"],
      actorUserId: ACTOR,
      reason: null,
    });

    expect(roster.events).toEqual([]);
    expect(roster.assignments).toHaveLength(1);
  });

  it("refuses demoting the last administrator and rolls the whole change back", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "administrator");

    const error = await refusal(
      service.setAccess({
        userId: "u1",
        role: "client",
        staffRoles: [],
        actorUserId: ACTOR,
        reason: null,
      }),
    );

    expect(error.reason).toBe("last_administrator");
    expect(roster.profiles.get("u1")).toEqual({ role: "staff", primaryStaffRole: "administrator" });
    expect(roster.events).toEqual([]);
  });

  it("notes the invitation on the access history for a new staff member", async () => {
    const { roster, service } = setup();

    await service.setAccess({
      userId: "new",
      role: "staff",
      staffRoles: ["specialist"],
      actorUserId: ACTOR,
      reason: "Accepted staff invitation",
      invitationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(roster.events.at(-1)).toEqual({
      type: "lax.staff_access.granted",
      payload: {
        schemaVersion: 1,
        subjectId: "new",
        product: "bid",
        role: "specialist",
        grantedBySubjectId: ACTOR,
        invitationId: "11111111-1111-4111-8111-111111111111",
      },
    });
  });
});

describe("StaffRoleAssignmentService.list", () => {
  it("lists roles in force and those starting later, not those that ended", async () => {
    const { roster, service } = setup();
    roster.hold("u1", "specialist");
    roster.hold("u1", "cataloguer", EARLIER);

    expect((await service.list("u1")).map((a) => a.role)).toEqual(["specialist"]);
  });
});
