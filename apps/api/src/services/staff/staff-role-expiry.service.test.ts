import type {
  IStaffRoster,
  IStaffRosterTransaction,
  StaffProfileRoles,
  StaffRoleAssignmentRecord,
  StaffRosterEvent,
} from "@auction/persistence/interfaces";
import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type EndedStaffRole,
  type IStaffRoleExpiryNotifier,
  StaffRoleExpiryService,
} from "./staff-role-expiry.service.js";

const NOW = new Date("2026-11-04T03:00:00.000Z");
const HOUR = 3_600_000;
const LONG_AGO = new Date("2026-01-01T00:00:00.000Z");

/** In-memory roster that applies the same "unrecorded end" rule as the database. */
class FakeRoster implements IStaffRoster {
  assignments: StaffRoleAssignmentRecord[] = [];
  recorded = new Set<string>();
  profiles = new Map<string, StaffProfileRoles>();
  events: StaffRosterEvent[] = [];
  private nextId = 1;

  hold(userId: string, role: UserStaffRole, endsAt: Date | null, recorded = false) {
    const id = `a${this.nextId++}`;
    this.assignments.push({
      id,
      userId,
      role,
      startsAt: LONG_AGO,
      endsAt,
      grantedByUserId: null,
      grantedAt: LONG_AGO,
      reason: null,
    });
    if (recorded) this.recorded.add(id);
    if (!this.profiles.has(userId)) {
      this.profiles.set(userId, { role: "staff", primaryStaffRole: role });
    }
    return id;
  }

  async listCurrent(userId: string, now: Date) {
    return this.assignments.filter(
      (a) => a.userId === userId && (a.endsAt === null || a.endsAt > now),
    );
  }

  async listActiveRoles() {
    return [];
  }

  async transact<T>(work: (tx: IStaffRosterTransaction) => Promise<T>): Promise<T> {
    const tx: IStaffRosterTransaction = {
      listCurrent: (userId, now) => this.listCurrent(userId, now),
      countOtherActiveAdministrators: async () => 1,
      insert: async () => {
        throw new Error("not used");
      },
      end: async () => undefined,
      listUnrecordedEnds: async (now, limit) =>
        this.assignments
          .filter((a) => a.endsAt !== null && a.endsAt <= now && !this.recorded.has(a.id))
          .slice(0, limit),
      recordEnds: async (ids) => {
        for (const id of ids) this.recorded.add(id);
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
    return work(tx);
  }
}

class FakeNotifier implements IStaffRoleExpiryNotifier {
  calls: EndedStaffRole[][] = [];
  async notifyEnded(ended: readonly EndedStaffRole[]) {
    this.calls.push([...ended]);
  }
  get notified() {
    return this.calls.flat();
  }
}

function setup(batchSize?: number) {
  const roster = new FakeRoster();
  const notifier = new FakeNotifier();
  const service = new StaffRoleExpiryService(roster, notifier, () => NOW, batchSize);
  return { roster, notifier, service };
}

const ended = new Date(NOW.getTime() - HOUR);
const types = (roster: FakeRoster) => roster.events.map((e) => e.type);

describe("StaffRoleExpiryService", () => {
  it("records an ended role once, writes its audit event and notifies", async () => {
    const { roster, notifier, service } = setup();
    const id = roster.hold("ada", "saleroom_clerk", ended);

    await expect(service.expireEndedRoles()).resolves.toEqual({ expired: 1, people: 1 });

    expect(roster.recorded.has(id)).toBe(true);
    expect(roster.events).toContainEqual({
      type: "staff.role_expired",
      userId: "ada",
      payload: { assignmentId: id, role: "saleroom_clerk", endedAt: ended.toISOString() },
    });
    expect(notifier.notified).toEqual([
      { assignmentId: id, userId: "ada", role: "saleroom_clerk", endedAt: ended },
    ]);
  });

  it("is a no-op the second time: nothing recorded, no event, no notice", async () => {
    const { roster, notifier, service } = setup();
    roster.hold("ada", "saleroom_clerk", ended);
    await service.expireEndedRoles();
    const events = roster.events.length;

    await expect(service.expireEndedRoles()).resolves.toEqual({ expired: 0, people: 0 });

    expect(roster.events).toHaveLength(events);
    expect(notifier.calls).toHaveLength(1);
  });

  it("ignores roles that are open, end later, or already have their end recorded", async () => {
    const { roster, notifier, service } = setup();
    roster.hold("ada", "specialist", null);
    roster.hold("ben", "finance", new Date(NOW.getTime() + HOUR));
    roster.hold("cy", "cataloguer", ended, true);

    await expect(service.expireEndedRoles()).resolves.toEqual({ expired: 0, people: 0 });

    expect(roster.events).toEqual([]);
    expect(notifier.calls).toEqual([]);
  });

  it("writes one profile update per person even with two ended roles", async () => {
    const { roster, notifier, service } = setup();
    roster.hold("ada", "saleroom_clerk", ended);
    roster.hold("ada", "cataloguer", ended);
    roster.hold("ada", "finance", null);

    await expect(service.expireEndedRoles()).resolves.toEqual({ expired: 2, people: 1 });

    expect(types(roster).filter((t) => t === "staff.role_expired")).toHaveLength(2);
    expect(roster.profiles.get("ada")).toEqual({ role: "staff", primaryStaffRole: "finance" });
    expect(types(roster).filter((t) => t.startsWith("lax.staff_access"))).toHaveLength(1);
    expect(notifier.calls).toHaveLength(1);
    expect(notifier.notified).toHaveLength(2);
  });

  it("clears the shown role when the last role ends and records the access change", async () => {
    const { roster, service } = setup();
    roster.hold("ada", "saleroom_clerk", ended);

    await service.expireEndedRoles();

    expect(roster.profiles.get("ada")).toEqual({ role: "staff", primaryStaffRole: null });
    const access = roster.events.find((e) => e.type === "lax.staff_access.granted");
    expect(access).toMatchObject({ payload: { subjectId: "ada", role: "staff" } });
  });

  it("keeps the shown role and writes no access event when another role stays", async () => {
    const { roster, service } = setup();
    roster.hold("ada", "administrator", null);
    roster.hold("ada", "specialist", ended);

    await service.expireEndedRoles();

    expect(roster.profiles.get("ada")?.primaryStaffRole).toBe("administrator");
    expect(types(roster)).toEqual(["staff.role_expired"]);
  });

  it("works through more ended roles than one batch and notifies after each commit", async () => {
    const { roster, notifier, service } = setup(2);
    for (const person of ["a", "b", "c"]) roster.hold(person, "specialist", ended);

    await expect(service.expireEndedRoles()).resolves.toEqual({ expired: 3, people: 3 });

    expect(notifier.calls.map((c) => c.length)).toEqual([2, 1]);
  });
});
