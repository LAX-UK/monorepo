import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  domainEvent,
  staffRoleAssignment,
  user,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleAdminUserReader } from "./drizzle-admin-user.reader.js";
import { DrizzleBidBidderRoleReader } from "./drizzle-bid-bidder-role.reader.js";
import { DrizzleStaffRoster } from "./drizzle-staff-roster.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const HOUR = 3_600_000;

describe.skipIf(!HAS_DB)("staff roster (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const actorId = `roster_actor_${run}`;
  const memberId = `roster_member_${run}`;
  const otherAdminId = `roster_admin_${run}`;
  const subjects = [actorId, memberId, otherAdminId];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const roster = new DrizzleStaffRoster(db);

  async function cleanup(): Promise<void> {
    await db
      .delete(domainEvent)
      .where(
        and(eq(domainEvent.aggregateType, "user"), inArray(domainEvent.aggregateId, subjects)),
      );
    await db.delete(bidUserProfile).where(inArray(bidUserProfile.userId, subjects));
    await db.delete(bidIdentityDirectory).where(inArray(bidIdentityDirectory.subjectId, subjects));
    await db.delete(user).where(inArray(user.id, subjects));
  }

  beforeEach(async () => {
    await cleanup();
    const t = new Date();
    await db.insert(user).values(
      subjects.map((id) => ({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      })),
    );
    await db.insert(bidIdentityDirectory).values(
      subjects.map((id) => ({
        subjectId: id,
        email: `${id}@integration.test`,
        name: id,
        emailVerified: true,
        identityCreatedAt: t,
        replicatedAt: t,
      })),
    );
  });

  afterAll(cleanup);

  it("stores, lists, ends and audits assignments in one transaction", async () => {
    const now = new Date();
    const assigned = await roster.transact(async (tx) => {
      await tx.writeProfileRoles(memberId, { role: "staff", primaryStaffRole: "specialist" });
      const record = await tx.insert({
        userId: memberId,
        role: "specialist",
        startsAt: new Date(now.getTime() - HOUR),
        endsAt: null,
        grantedByUserId: actorId,
        reason: "covering cataloguing",
      });
      await tx.insert({
        userId: memberId,
        role: "client_services",
        startsAt: new Date(now.getTime() + HOUR),
        endsAt: null,
        grantedByUserId: actorId,
        reason: null,
      });
      await tx.recordEvents([
        {
          type: "staff.role_assigned",
          userId: memberId,
          actorUserId: actorId,
          payload: {
            assignmentId: record.id,
            role: "specialist",
            startsAt: record.startsAt.toISOString(),
            endsAt: null,
            reason: "covering cataloguing",
          },
        },
      ]);
      return record;
    });

    expect(await roster.listActiveRoles(memberId, now)).toEqual(["specialist"]);
    expect((await roster.listCurrent(memberId, now)).map((a) => a.role)).toEqual([
      "specialist",
      "client_services",
    ]);
    expect(await new DrizzleBidBidderRoleReader(db).findBidderRole(memberId)).toEqual({
      role: "staff",
      staffRoles: ["specialist"],
    });

    const [listed] = await new DrizzleAdminUserReader(db).getByIds([memberId]);
    expect(listed).toMatchObject({ staffRole: "specialist", staffRoles: ["specialist"] });

    await roster.transact((tx) => tx.end(assigned.id, now));
    expect(await roster.listActiveRoles(memberId, now)).toEqual([]);
    const [ended] = await db
      .select({
        endsAt: staffRoleAssignment.endsAt,
        grantedBy: staffRoleAssignment.grantedByUserId,
      })
      .from(staffRoleAssignment)
      .where(eq(staffRoleAssignment.id, assigned.id));
    expect(ended).toEqual({ endsAt: now, grantedBy: actorId });

    const events = await db
      .select({ type: domainEvent.eventType, actor: domainEvent.actorUserId })
      .from(domainEvent)
      .where(eq(domainEvent.aggregateId, memberId));
    expect(events).toEqual([{ type: "staff.role_assigned", actor: actorId }]);
  });

  it("refuses a second open-ended row for the same role", async () => {
    const insert = () =>
      roster.transact(async (tx) => {
        await tx.writeProfileRoles(memberId, { role: "staff", primaryStaffRole: "specialist" });
        await tx.insert({
          userId: memberId,
          role: "specialist",
          startsAt: new Date(),
          endsAt: null,
          grantedByUserId: actorId,
          reason: null,
        });
      });
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it("counts other active, unsuspended administrators", async () => {
    const now = new Date();
    await roster.transact(async (tx) => {
      for (const id of [memberId, otherAdminId]) {
        await tx.writeProfileRoles(id, { role: "staff", primaryStaffRole: "administrator" });
        await tx.insert({
          userId: id,
          role: "administrator",
          startsAt: new Date(now.getTime() - HOUR),
          endsAt: null,
          grantedByUserId: actorId,
          reason: null,
        });
      }
    });
    expect(await roster.transact((tx) => tx.countOtherActiveAdministrators(memberId, now))).toBe(1);

    await db
      .update(bidUserProfile)
      .set({ suspendedAt: now })
      .where(eq(bidUserProfile.userId, otherAdminId));
    expect(await roster.transact((tx) => tx.countOtherActiveAdministrators(memberId, now))).toBe(0);
  });

  it("returns the profile roles it replaced", async () => {
    const first = await roster.transact((tx) =>
      tx.writeProfileRoles(memberId, { role: "staff", primaryStaffRole: "specialist" }),
    );
    expect(first).toBeNull();
    const second = await roster.transact((tx) =>
      tx.writeProfileRoles(memberId, { role: "client", primaryStaffRole: null }),
    );
    expect(second).toEqual({ role: "staff", primaryStaffRole: "specialist" });
  });
});
