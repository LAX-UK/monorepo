import {
  domainEvent,
  shopAdminAudit,
  shopStaffAccessInbox,
  shopStaffMember,
  shopStaffRoleAssignment,
} from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
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

  async function heldRoles(db: ReturnType<typeof createShopDb>, subject: string) {
    const rows = await db
      .select({ role: shopStaffRoleAssignment.role })
      .from(shopStaffRoleAssignment)
      .where(
        and(
          eq(shopStaffRoleAssignment.identitySubjectId, subject),
          isNull(shopStaffRoleAssignment.endsAt),
        ),
      );
    return rows.map((r) => r.role).sort();
  }

  it("adds roles, ends one, then ends the rest, with the Bid actor in the audit log", async () => {
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
      reason: "Covers the Marylebone clients",
    });
    const editorId = await emit(db, "lax.staff_access.granted", {
      subjectId,
      product: "shop",
      role: "editor",
      grantedBySubjectId: inviterId,
      invitationId: null,
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await run();

    expect(await inboxRow(db, grantId)).toEqual({ status: "completed", lastError: null });
    expect(await inboxRow(db, editorId)).toEqual({ status: "completed", lastError: null });
    expect(await heldRoles(db, subjectId)).toEqual(["broker"]);
    const [editor] = await db
      .select()
      .from(shopStaffRoleAssignment)
      .where(
        and(
          eq(shopStaffRoleAssignment.identitySubjectId, subjectId),
          eq(shopStaffRoleAssignment.role, "editor"),
        ),
      );
    expect(editor?.endsAt).toBeInstanceOf(Date);
    expect(editor?.grantedEventId).toBe(editorId);
    expect(requireDefined(await staffRow(db, subjectId), "staff row")).toMatchObject({
      role: "broker",
      disabledAt: null,
    });
    const audits = await db
      .select({ actor: shopAdminAudit.actorSubjectId, action: shopAdminAudit.action })
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetType, "shop_staff_role_assignment"),
          eq(shopAdminAudit.actorSubjectId, inviterId),
        ),
      );
    expect(audits).toHaveLength(2);
    expect(audits.every((a) => a.action === "staff_role_assign")).toBe(true);

    const removeBroker = await emit(db, "lax.staff_access.revoked", {
      subjectId,
      product: "shop",
      role: "broker",
      revokedBySubjectId: inviterId,
      reason: "Moved to the editorial team",
    });
    await run();
    expect(await inboxRow(db, removeBroker)).toEqual({ status: "completed", lastError: null });
    expect(await heldRoles(db, subjectId)).toEqual([]);
    expect((await staffRow(db, subjectId))?.role).toBe("editor");

    const revokeAll = await emit(db, "lax.staff_access.revoked", {
      subjectId,
      product: "shop",
      revokedBySubjectId: inviterId,
    });
    await run();
    expect(await inboxRow(db, revokeAll)).toEqual({ status: "completed", lastError: null });
    expect((await staffRow(db, subjectId))?.disabledAt).toBeInstanceOf(Date);
  });

  it("dead-letters a forbidden pair and completes a role already held without a change", async () => {
    const db = createShopDb(shopPool);
    const run = createProcessStaffAccessInboxRunner(db, null);
    const suffix = integrationSuffix("staff-access-pair");
    const subjectId = `staff-access-pair-${suffix}`;
    const grant = (role: string) =>
      emit(db, "lax.staff_access.granted", {
        subjectId,
        product: "shop",
        role,
        grantedBySubjectId: "inviter",
        invitationId: null,
      });

    await grant("broker");
    await run();
    const again = await grant("broker");
    const finance = await grant("finance");
    await run();

    expect(await inboxRow(db, again)).toEqual({ status: "completed", lastError: null });
    expect(await inboxRow(db, finance)).toEqual({
      status: "dead",
      lastError: "shop_staff_role_refused:forbidden_combination:finance:broker",
    });
    expect(await heldRoles(db, subjectId)).toEqual(["broker"]);
  });

  it("records the end of a role whose end date passed, once", async () => {
    const db = createShopDb(shopPool);
    const run = createProcessStaffAccessInboxRunner(db, null);
    const suffix = integrationSuffix("staff-access-expiry");
    const subjectId = `staff-access-expiry-${suffix}`;
    await emit(db, "lax.staff_access.granted", {
      subjectId,
      product: "shop",
      role: "operations",
      grantedBySubjectId: "inviter",
      invitationId: null,
    });
    await run();
    const [assignment] = await db
      .update(shopStaffRoleAssignment)
      .set({ endsAt: new Date(Date.now() - 1_000) })
      .where(eq(shopStaffRoleAssignment.identitySubjectId, subjectId))
      .returning({ id: shopStaffRoleAssignment.id });
    const assignmentId = requireDefined(assignment?.id, "assignment id");

    const expiry = () =>
      emit(db, "lax.staff_access.revoked", {
        subjectId,
        product: "shop",
        revokedBySubjectId: subjectId,
        role: "operations",
        assignmentId,
      });
    const first = await expiry();
    const second = await expiry();
    await run();

    expect(await inboxRow(db, first)).toEqual({ status: "completed", lastError: null });
    expect(await inboxRow(db, second)).toEqual({ status: "completed", lastError: null });
    const expired = await db
      .select({ id: shopAdminAudit.id })
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetId, assignmentId),
          eq(shopAdminAudit.action, "staff_role_expire"),
        ),
      );
    expect(expired).toHaveLength(1);
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
      role: "administrator",
      grantedBySubjectId: "inviter",
      invitationId: null,
    });
    await run();

    expect(await inboxRow(db, eventId)).toEqual({
      status: "dead",
      lastError: "unknown_shop_role:administrator",
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
