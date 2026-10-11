import {
  domainEvent,
  shopAdminAudit,
  shopStaffAccessInbox,
  shopStaffMember,
} from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationSuffix, requireDefined } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createProcessStaffAccessInboxRunner } from "./scheduler/process-staff-access-inbox.runner.js";

describe.skipIf(!hasShopIntegrationDb)("shop staff access inbox (integration)", () => {
  let shopPool!: pg.Pool;
  let ownerPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function emit(
    db: ReturnType<typeof createShopDb>,
    eventType: "lax.staff_access.granted" | "lax.staff_access.revoked",
    payload: Record<string, unknown>,
  ): Promise<number> {
    const [event] = await db
      .insert(domainEvent)
      .values({
        aggregateType: "user",
        aggregateId: String(payload.subjectId),
        eventType,
        payload: { schemaVersion: 1, ...payload },
        schemaVersion: 1,
        producer: "apps/api",
        occurredAt: new Date(),
      })
      .returning({ id: domainEvent.id });
    return requireDefined(event?.id, "event id");
  }

  async function inboxRow(db: ReturnType<typeof createShopDb>, eventId: number) {
    const [row] = await db
      .select({ status: shopStaffAccessInbox.status, lastError: shopStaffAccessInbox.lastError })
      .from(shopStaffAccessInbox)
      .where(eq(shopStaffAccessInbox.eventId, eventId));
    return row;
  }

  async function staffRow(db: ReturnType<typeof createShopDb>, subject: string) {
    const [row] = await db
      .select({
        id: shopStaffMember.id,
        role: shopStaffMember.role,
        disabledAt: shopStaffMember.disabledAt,
      })
      .from(shopStaffMember)
      .where(eq(shopStaffMember.identitySubjectId, subject));
    return row;
  }

  it("grants then revokes Shop staff access with the inviter recorded as operator", async () => {
    const db = createShopDb(shopPool);
    const run = createProcessStaffAccessInboxRunner(db, null);
    const suffix = integrationSuffix("staff-access");
    const subjectId = `staff-access-subject-${suffix}`;
    const inviterId = `staff-access-inviter-${suffix}`;

    const grantId = await emit(db, "lax.staff_access.granted", {
      subjectId,
      product: "shop",
      role: "broker",
      grantedBySubjectId: inviterId,
      invitationId: null,
    });
    await run();

    expect(await inboxRow(db, grantId)).toEqual({ status: "completed", lastError: null });
    const granted = requireDefined(await staffRow(db, subjectId), "staff row");
    expect(granted).toMatchObject({ role: "broker", disabledAt: null });
    const audits = await db
      .select({ actor: shopAdminAudit.actorSubjectId, action: shopAdminAudit.action })
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetId, granted.id),
          eq(shopAdminAudit.action, "staff_grant_create"),
        ),
      );
    expect(audits).toEqual([{ actor: inviterId, action: "staff_grant_create" }]);

    const revokeId = await emit(db, "lax.staff_access.revoked", {
      subjectId,
      product: "shop",
      revokedBySubjectId: inviterId,
    });
    await run();

    expect(await inboxRow(db, revokeId)).toEqual({ status: "completed", lastError: null });
    expect((await staffRow(db, subjectId))?.disabledAt).toBeInstanceOf(Date);
  });

  it("dead-letters a role Shop does not know instead of retrying", async () => {
    const db = createShopDb(shopPool);
    const run = createProcessStaffAccessInboxRunner(db, null);
    const suffix = integrationSuffix("staff-access-dead");
    const subjectId = `staff-access-dead-${suffix}`;

    const eventId = await emit(db, "lax.staff_access.granted", {
      subjectId,
      product: "shop",
      role: "super_admin",
      grantedBySubjectId: "inviter",
      invitationId: null,
    });
    await run();

    expect(await inboxRow(db, eventId)).toEqual({
      status: "dead",
      lastError: "unknown_shop_role:super_admin",
    });
    expect(await staffRow(db, subjectId)).toBeUndefined();
  });

  it("ignores grants for other platforms", async () => {
    const db = createShopDb(shopPool);
    const run = createProcessStaffAccessInboxRunner(db, null);
    const suffix = integrationSuffix("staff-access-bid");

    const eventId = await emit(db, "lax.staff_access.granted", {
      subjectId: `staff-access-bid-${suffix}`,
      product: "bid",
      role: "specialist",
      grantedBySubjectId: "inviter",
      invitationId: null,
    });
    await run();

    expect(await inboxRow(db, eventId)).toBeUndefined();
  });
});
