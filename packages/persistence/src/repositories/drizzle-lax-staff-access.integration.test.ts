import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  domainEvent,
  laxStaffAccessDirectory,
  shopStaffMember,
  shopStaffRoleAssignment,
  user,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DrizzleLaxAdminRolesRepository } from "./drizzle-lax-admin-roles.repository.js";
import { DrizzleLaxStaffAccessRepository } from "./drizzle-lax-staff-access.repository.js";
import { DrizzleStaffRoster } from "./drizzle-staff-roster.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("LAX staff access directory and history (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const actorId = `lax_access_actor_${run}`;
  const memberId = `lax_access_member_${run}`;
  const subjects = [actorId, memberId];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const roster = new DrizzleStaffRoster(db);
  const access = new DrizzleLaxStaffAccessRepository(db);
  const laxRoles = new DrizzleLaxAdminRolesRepository(db);

  async function cleanup(): Promise<void> {
    await db
      .delete(domainEvent)
      .where(
        and(eq(domainEvent.aggregateType, "user"), inArray(domainEvent.aggregateId, subjects)),
      );
    await db.delete(shopStaffMember).where(inArray(shopStaffMember.identitySubjectId, subjects));
    await db.delete(bidUserProfile).where(inArray(bidUserProfile.userId, subjects));
    await db.delete(bidIdentityDirectory).where(inArray(bidIdentityDirectory.subjectId, subjects));
    await db.delete(user).where(inArray(user.id, subjects));
  }

  async function directory() {
    const rows = await access.listForSubjects([memberId]);
    return rows.map(({ product, role }) => ({ product, role }));
  }

  async function history() {
    const rows = await access.history(memberId, 20);
    return rows.map(({ product, action, role, actorSubjectId }) => ({
      product,
      action,
      role,
      actorSubjectId,
    }));
  }

  beforeAll(async () => {
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
    await db.insert(bidIdentityDirectory).values({
      subjectId: memberId,
      email: `${memberId}@integration.test`,
      name: "Member",
      emailVerified: true,
      identityCreatedAt: t,
      replicatedAt: t,
    });
  });

  afterAll(cleanup);

  async function setBidRole(primaryStaffRole: "specialist" | "finance" | null) {
    await roster.transact(async (tx) => {
      await tx.writeProfileRoles(memberId, {
        role: primaryStaffRole ? "staff" : "client",
        primaryStaffRole,
      });
      await tx.recordEvents([
        primaryStaffRole
          ? {
              type: "lax.staff_access.granted",
              payload: {
                schemaVersion: 1,
                subjectId: memberId,
                product: "bid",
                role: primaryStaffRole,
                grantedBySubjectId: actorId,
                invitationId: null,
              },
            }
          : {
              type: "lax.staff_access.revoked",
              payload: {
                schemaVersion: 1,
                subjectId: memberId,
                product: "bid",
                revokedBySubjectId: actorId,
              },
            },
      ]);
    });
  }

  it("mirrors the Bid profile role and lists each recorded change", async () => {
    await setBidRole("specialist");
    expect(await directory()).toEqual([{ product: "bid", role: "specialist" }]);

    await setBidRole("finance");
    expect(await directory()).toEqual([{ product: "bid", role: "finance" }]);

    await setBidRole(null);
    expect(await directory()).toEqual([]);

    expect(await history()).toEqual([
      { product: "bid", action: "revoked", role: null, actorSubjectId: actorId },
      { product: "bid", action: "granted", role: "finance", actorSubjectId: actorId },
      { product: "bid", action: "granted", role: "specialist", actorSubjectId: actorId },
    ]);
  });

  it("records LAX Admin requests without touching the directories until LAX Admin applies them", async () => {
    const t0 = new Date(Date.now() - 1_000);
    await laxRoles.requestGrant({
      subjectId: memberId,
      role: "broker",
      endsAt: null,
      reason: "Covers the Marylebone clients",
      actorSubjectId: actorId,
    });
    expect(await directory()).toEqual([]);
    expect(await laxRoles.listCurrent(memberId, new Date())).toEqual([]);
    expect(await laxRoles.listRequestsSince(memberId, t0)).toMatchObject([
      { kind: "assign", role: "broker", endsAt: null },
    ]);
    expect((await history())[0]).toEqual({
      product: "shop",
      action: "granted",
      role: "broker",
      actorSubjectId: actorId,
    });

    // LAX Admin applies it: the staff record and the assignment, which both directories mirror.
    await db.insert(shopStaffMember).values({ identitySubjectId: memberId, role: "broker" });
    const [assignment] = await db
      .insert(shopStaffRoleAssignment)
      .values({ identitySubjectId: memberId, role: "broker", startsAt: t0 })
      .returning({ id: shopStaffRoleAssignment.id });
    expect(await directory()).toEqual([{ product: "shop", role: "broker" }]);
    expect((await laxRoles.listCurrent(memberId, new Date())).map((a) => a.role)).toEqual([
      "broker",
    ]);
    expect(
      await laxRoles.countOtherActiveAdministrators(memberId, new Date()),
    ).toBeGreaterThanOrEqual(0);

    // Its end date passes: the expiry asks LAX Admin to record the end once.
    await db
      .update(shopStaffRoleAssignment)
      .set({ endsAt: new Date(Date.now() - 500) })
      .where(eq(shopStaffRoleAssignment.id, assignment?.id ?? ""));
    const [first, second] = await Promise.all([
      laxRoles.requestDueEnds(new Date(), 500),
      laxRoles.requestDueEnds(new Date(), 500),
    ]);
    const asked = [...(first ?? []), ...(second ?? [])].filter((e) => e.subjectId === memberId);
    expect(asked).toEqual([
      expect.objectContaining({ assignmentId: assignment?.id, role: "broker" }),
    ]);
    expect(
      (await laxRoles.requestDueEnds(new Date(), 500)).filter((e) => e.subjectId === memberId),
    ).toEqual([]);

    await db
      .update(shopStaffMember)
      .set({ disabledAt: new Date() })
      .where(eq(shopStaffMember.identitySubjectId, memberId));
    expect(await directory()).toEqual([]);
    const [raw] = await db
      .select()
      .from(laxStaffAccessDirectory)
      .where(eq(laxStaffAccessDirectory.subjectId, memberId));
    expect(raw).toBeUndefined();
  });
});
