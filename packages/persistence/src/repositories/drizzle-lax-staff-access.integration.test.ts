import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  domainEvent,
  laxStaffAccessDirectory,
  shopStaffMember,
  user,
} from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleAdminUserRoleManager } from "./drizzle-admin-user.reader.js";
import { DrizzleLaxStaffAccessRepository } from "./drizzle-lax-staff-access.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("LAX staff access directory and history (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const actorId = `lax_access_actor_${run}`;
  const memberId = `lax_access_member_${run}`;
  const subjects = [actorId, memberId];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const roles = new DrizzleAdminUserRoleManager(db);
  const access = new DrizzleLaxStaffAccessRepository(db);

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

  it("mirrors Bid role changes and records each change once", async () => {
    await roles.setRoleAndStaff(memberId, "staff", "specialist", actorId);
    await roles.setRoleAndStaff(memberId, "staff", "specialist", actorId);
    expect(await directory()).toEqual([{ product: "bid", role: "specialist" }]);

    await roles.setRoleAndStaff(memberId, "staff", "finance_ops", actorId);
    expect(await directory()).toEqual([{ product: "bid", role: "finance_ops" }]);

    await roles.setRoleAndStaff(memberId, "client", null, actorId);
    expect(await directory()).toEqual([]);

    expect(await history()).toEqual([
      { product: "bid", action: "revoked", role: null, actorSubjectId: actorId },
      { product: "bid", action: "granted", role: "finance_ops", actorSubjectId: actorId },
      { product: "bid", action: "granted", role: "specialist", actorSubjectId: actorId },
    ]);
  });

  it("records Shop requests without touching the directory until Shop applies them", async () => {
    await access.requestGrant({
      subjectId: memberId,
      product: "shop",
      role: "broker",
      actorSubjectId: actorId,
    });
    expect(await directory()).toEqual([]);
    expect((await history())[0]).toEqual({
      product: "shop",
      action: "granted",
      role: "broker",
      actorSubjectId: actorId,
    });

    await db.insert(shopStaffMember).values({ identitySubjectId: memberId, role: "broker" });
    expect(await directory()).toEqual([{ product: "shop", role: "broker" }]);

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
