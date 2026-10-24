import { beforeEach, describe, expect, it, vi } from "vitest";

const writeBidUserProfile = vi.fn();
vi.mock("../bid-user-profile-sync.js", () => ({
  writeBidUserProfile: (...args: unknown[]) => writeBidUserProfile(...args),
}));

const insertLaxStaffAccessEvents = vi.fn();
vi.mock("./drizzle-lax-staff-access.repository.js", () => ({
  insertLaxStaffAccessEvents: (...args: unknown[]) => insertLaxStaffAccessEvents(...args),
}));

import { LastSuperAdminError } from "../interfaces/admin-user.repository.js";
import { DrizzleAdminUserRoleManager, removesSuperAdmin } from "./drizzle-admin-user.reader.js";

type Previous = { role: string; staffRole: string | null } | undefined;

/** `select` calls arrive in order: the target's current role, then (if guarded) the head count. */
function fakeDb(previous: Previous, otherActiveSuperAdmins: number) {
  const log: string[] = [];
  let selects = 0;
  const tx = {
    select: () => ({
      from: () => ({
        where: () => {
          selects += 1;
          if (selects === 1) {
            log.push("read-target");
            const rows = previous ? [previous] : [];
            const result = Promise.resolve(rows) as Promise<unknown[]> & {
              for: () => Promise<unknown[]>;
            };
            result.for = async () => rows;
            return result;
          }
          log.push("count-others");
          return Promise.resolve([{ n: otherActiveSuperAdmins }]);
        },
      }),
    }),
    execute: async () => {
      log.push("lock-roster");
    },
  };
  const db = {
    transaction: async (callback: (t: typeof tx) => Promise<void>) => callback(tx),
  };
  writeBidUserProfile.mockImplementation(async () => {
    log.push("write");
  });
  return { db, log };
}

describe("removesSuperAdmin", () => {
  const staff = (staffRole: string | null) => ({ role: "staff", staffRole });

  it("is true when a super_admin becomes another staff role or a customer", () => {
    expect(removesSuperAdmin(staff("super_admin"), staff("operations"))).toBe(true);
    expect(removesSuperAdmin(staff("super_admin"), { role: "client", staffRole: null })).toBe(true);
  });

  it("is false when super_admin is kept or was never held", () => {
    expect(removesSuperAdmin(staff("super_admin"), staff("super_admin"))).toBe(false);
    expect(removesSuperAdmin(staff("operations"), staff("finance_ops"))).toBe(false);
    expect(removesSuperAdmin(undefined, staff("operations"))).toBe(false);
    expect(
      removesSuperAdmin({ role: "client", staffRole: "super_admin" }, staff("operations")),
    ).toBe(false);
  });
});

describe("DrizzleAdminUserRoleManager last super_admin guard", () => {
  beforeEach(() => {
    writeBidUserProfile.mockReset();
    insertLaxStaffAccessEvents.mockReset();
  });

  it("refuses demoting the last active super_admin, under the roster lock, and writes nothing", async () => {
    const { db, log } = fakeDb({ role: "staff", staffRole: "super_admin" }, 0);
    const manager = new DrizzleAdminUserRoleManager(db as never);

    await expect(
      manager.setRoleAndStaff("target", "staff", "operations", "actor"),
    ).rejects.toBeInstanceOf(LastSuperAdminError);

    expect(log).toEqual(["read-target", "lock-roster", "count-others"]);
    expect(writeBidUserProfile).not.toHaveBeenCalled();
    expect(insertLaxStaffAccessEvents).not.toHaveBeenCalled();
  });

  it("refuses turning the last active super_admin into a customer", async () => {
    const { db } = fakeDb({ role: "staff", staffRole: "super_admin" }, 0);
    const manager = new DrizzleAdminUserRoleManager(db as never);

    await expect(manager.setRoleAndStaff("target", "client", null, "actor")).rejects.toBeInstanceOf(
      LastSuperAdminError,
    );
  });

  it("allows the demotion when another active super_admin remains", async () => {
    const { db, log } = fakeDb({ role: "staff", staffRole: "super_admin" }, 1);
    const manager = new DrizzleAdminUserRoleManager(db as never);

    await manager.setRoleAndStaff("target", "staff", "operations", "actor");

    expect(log).toEqual(["read-target", "lock-roster", "count-others", "write"]);
    expect(writeBidUserProfile).toHaveBeenCalledWith(expect.anything(), "target", {
      role: "staff",
      staffRole: "operations",
    });
  });

  it("does not lock or count when the change does not remove a super_admin", async () => {
    const { db, log } = fakeDb({ role: "staff", staffRole: "operations" }, 0);
    const manager = new DrizzleAdminUserRoleManager(db as never);

    await manager.setRoleAndStaff("target", "staff", "finance_ops", "actor");

    expect(log).toEqual(["read-target", "write"]);
  });

  it("records the access change with the actor", async () => {
    const { db } = fakeDb({ role: "staff", staffRole: "operations" }, 0);
    const manager = new DrizzleAdminUserRoleManager(db as never);

    await manager.setRoleAndStaff("target", "staff", "finance_ops", "actor");

    expect(insertLaxStaffAccessEvents).toHaveBeenCalledWith(expect.anything(), "apps/api", [
      {
        type: "lax.staff_access.granted",
        payload: expect.objectContaining({
          subjectId: "target",
          product: "bid",
          role: "finance_ops",
          grantedBySubjectId: "actor",
        }),
      },
    ]);
  });
});
