import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import type {
  ShopStaffRoleAssignmentRecord,
  ShopStaffRoster,
  ShopStaffRosterAuditEntry,
  ShopStaffRosterTransaction,
} from "../ports/shop-staff-roster.js";
import { ShopStaffRoleRefused, ShopStaffRosterService } from "./shop-staff-roster.service.js";

const NOW = new Date("2026-10-29T12:00:00Z");
const DAY = 86_400_000;

/** An in-memory roster: assignments, member records and the audit log. */
function fakeRoster(seed: { subjectId: string; role: ShopStaffRole; endsAt?: Date | null }[] = []) {
  let next = 0;
  const assignments: ShopStaffRoleAssignmentRecord[] = seed.map((s) => ({
    id: `a${next++}`,
    subjectId: s.subjectId,
    role: s.role,
    startsAt: new Date(NOW.getTime() - DAY),
    endsAt: s.endsAt ?? null,
    grantedBySubjectId: null,
    grantedAt: new Date(NOW.getTime() - DAY),
    reason: null,
    endRecordedAt: null,
  }));
  const members = new Map<string, { role: ShopStaffRole | null; disabled: boolean }>();
  const audit: ShopStaffRosterAuditEntry[] = [];
  const current = (subjectId: string, now: Date) =>
    assignments.filter(
      (a) => a.subjectId === subjectId && (a.endsAt === null || a.endsAt.getTime() > now.getTime()),
    );
  const tx: ShopStaffRosterTransaction = {
    listCurrent: async (subjectId, now) => current(subjectId, now),
    countOtherActiveAdministrators: async (subjectId, now) =>
      new Set(
        assignments
          .filter((a) => a.role === "shop_admin" && a.subjectId !== subjectId)
          .filter((a) => current(a.subjectId, now).includes(a))
          .map((a) => a.subjectId),
      ).size,
    findById: async (id) => assignments.find((a) => a.id === id) ?? null,
    ensureMember: async (subjectId, role) => {
      if (!members.has(subjectId)) members.set(subjectId, { role, disabled: false });
    },
    insert: async (a) => {
      const record = { ...a, id: `a${next++}`, grantedAt: NOW, endRecordedAt: null };
      assignments.push(record);
      return record;
    },
    end: async (id, endsAt) => {
      const i = assignments.findIndex((a) => a.id === id);
      const found = assignments[i];
      if (found) assignments[i] = { ...found, endsAt, endRecordedAt: endsAt };
    },
    recordEnd: async (id, at) => {
      const i = assignments.findIndex((a) => a.id === id);
      const found = assignments[i];
      if (found && found.endRecordedAt === null) assignments[i] = { ...found, endRecordedAt: at };
    },
    writeMember: async (subjectId, primaryRole) => {
      members.set(subjectId, { role: primaryRole, disabled: primaryRole === null });
    },
    audit: async (entry) => {
      audit.push(entry);
    },
  };
  const roster: ShopStaffRoster = { transact: (work) => work(tx) };
  return { roster, assignments, members, audit };
}

const by = { actorSubjectId: "admin-1", reason: "Covers the gallery", eventId: 42 };

describe("ShopStaffRosterService", () => {
  it("adds a role beside the ones held, audits it and keeps the primary role in step", async () => {
    const fake = fakeRoster([{ subjectId: "p", role: "catalogue_editor" }]);
    const service = new ShopStaffRosterService(fake.roster, () => NOW);

    await expect(
      service.assign({ ...by, subjectId: "p", role: "editor", endsAt: null }),
    ).resolves.toBe("applied");

    expect(fake.assignments.filter((a) => a.endsAt === null).map((a) => a.role)).toEqual([
      "catalogue_editor",
      "editor",
    ]);
    expect(fake.members.get("p")).toEqual({ role: "catalogue_editor", disabled: false });
    expect(fake.audit).toMatchObject([{ action: "staff_role_assign", actorSubjectId: "admin-1" }]);
  });

  it("changes nothing for a role already held", async () => {
    const fake = fakeRoster([{ subjectId: "p", role: "broker" }]);
    const service = new ShopStaffRosterService(fake.roster, () => NOW);
    await expect(
      service.assign({ ...by, subjectId: "p", role: "broker", endsAt: null }),
    ).resolves.toBe("unchanged");
    expect(fake.audit).toEqual([]);
  });

  it.each<[ShopStaffRole, ShopStaffRole]>([
    ["broker", "finance"],
    ["account_manager", "finance"],
    ["finance", "broker"],
    ["editor", "shop_admin"],
    ["editor", "read_only"],
  ])("refuses %s with %s and writes nothing", async (held, requested) => {
    const fake = fakeRoster([{ subjectId: "p", role: held }]);
    const service = new ShopStaffRosterService(fake.roster, () => NOW);
    await expect(
      service.assign({ ...by, subjectId: "p", role: requested, endsAt: null }),
    ).rejects.toBeInstanceOf(ShopStaffRoleRefused);
    expect(fake.assignments).toHaveLength(1);
    expect(fake.audit).toEqual([]);
  });

  it("ends one role and disables the record when no role is left", async () => {
    const fake = fakeRoster([
      { subjectId: "p", role: "operations" },
      { subjectId: "p", role: "editor" },
    ]);
    const service = new ShopStaffRosterService(fake.roster, () => NOW);

    await service.remove({ ...by, subjectId: "p", role: "operations" });
    expect(fake.members.get("p")).toEqual({ role: "editor", disabled: false });

    await service.remove({ ...by, subjectId: "p", role: null });
    expect(fake.members.get("p")).toEqual({ role: null, disabled: true });
    expect(fake.audit.map((a) => a.action)).toEqual(["staff_role_remove", "staff_role_remove"]);
  });

  it("never removes the last Administrator, and allows it when another remains", async () => {
    const alone = fakeRoster([{ subjectId: "p", role: "shop_admin" }]);
    await expect(
      new ShopStaffRosterService(alone.roster, () => NOW).remove({
        ...by,
        subjectId: "p",
        role: "shop_admin",
      }),
    ).rejects.toMatchObject({ reason: "last_administrator" });

    const two = fakeRoster([
      { subjectId: "p", role: "shop_admin" },
      { subjectId: "q", role: "shop_admin" },
    ]);
    await expect(
      new ShopStaffRosterService(two.roster, () => NOW).remove({
        ...by,
        subjectId: "p",
        role: "shop_admin",
      }),
    ).resolves.toBe("applied");
  });

  it("records an expired role's end once, and ignores one still running", async () => {
    const fake = fakeRoster([
      { subjectId: "p", role: "finance", endsAt: new Date(NOW.getTime() - 1000) },
      { subjectId: "p", role: "operations", endsAt: new Date(NOW.getTime() + DAY) },
    ]);
    const service = new ShopStaffRosterService(fake.roster, () => NOW);
    const expire = (assignmentId: string) =>
      service.recordExpiry({ ...by, subjectId: "p", assignmentId });

    await expect(expire("a0")).resolves.toBe("applied");
    await expect(expire("a0")).resolves.toBe("unchanged");
    await expect(expire("a1")).resolves.toBe("unchanged");
    expect(fake.audit.map((a) => a.action)).toEqual(["staff_role_expire"]);
    expect(fake.members.get("p")).toEqual({ role: "operations", disabled: false });
  });
});
