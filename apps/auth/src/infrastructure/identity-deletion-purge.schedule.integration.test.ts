import { createIdentityDb } from "@auction/identity-db";
import {
  authSecurityEffectOutbox,
  identityLifecycleOutbox,
  user,
} from "@auction/identity-db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DurableSecurityEffects } from "../services/durable-security-effects.js";
import { DrizzleDeletionPurgeRepository } from "./drizzle-deletion-purge.repository.js";
import { createDrizzleIdentityEventPublisher } from "./drizzle-identity-event-publisher.js";
import { DrizzleIdentitySubjectRepository } from "./drizzle-identity-subject-repository.js";
import { DrizzleSecurityEffectOutboxRepository } from "./drizzle-security-effect-outbox.repository.js";

const DATABASE_URL = process.env.DATABASE_URL;
const DAY = 24 * 60 * 60_000;
const now = new Date("2026-12-03T03:00:00Z");
const cutoff = new Date(now.getTime() - 30 * DAY);

const dueId = "deletion-purge-it-due";
const coolingId = "deletion-purge-it-cooling";
const heldId = "deletion-purge-it-held";
const weekOutId = "deletion-purge-it-week-out";
const ids = [dueId, coolingId, heldId, weekOutId] as const;

const REASONS = [
  { code: "bid_unpaid_invoices", message: "You have an unpaid invoice.", href: null },
] as const;

function person(id: string, requestedDaysAgo: number) {
  return {
    id,
    name: `Person ${id}`,
    email: `${id}@example.com`,
    image: `https://example.com/${id}.png`,
    deletionRequestedAt: new Date(now.getTime() - requestedDaysAgo * DAY),
    createdAt: now,
    updatedAt: now,
  };
}

describe.skipIf(!DATABASE_URL)("deletion purge against the database", () => {
  const db = DATABASE_URL ? createIdentityDb(DATABASE_URL) : undefined;
  const repo = db
    ? new DrizzleDeletionPurgeRepository(db, createDrizzleIdentityEventPublisher(db))
    : undefined;

  async function clean() {
    if (!db) return;
    await db
      .delete(authSecurityEffectOutbox)
      .where(inArray(authSecurityEffectOutbox.userId, [...ids]));
    await db
      .delete(identityLifecycleOutbox)
      .where(inArray(identityLifecycleOutbox.aggregateId, [...ids]));
    await db.delete(user).where(inArray(user.id, [...ids]));
  }

  beforeEach(async () => {
    if (!db) return;
    await clean();
    await db
      .insert(user)
      .values([
        person(dueId, 31),
        person(coolingId, 29),
        { ...person(heldId, 40), deletionHeldAt: new Date(now.getTime() - DAY) },
        person(weekOutId, 24),
      ]);
  });

  afterAll(clean);

  it("lists only people past the grace period, oldest first", async () => {
    const due = await repo?.listDue({ cutoff, after: null, limit: 10 });
    expect(due?.map((s) => s.id).filter((id) => ids.includes(id as never))).toEqual([
      heldId,
      dueId,
    ]);
  });

  it("records a hold once, refreshes it when the reasons change, and tells staff each time", async () => {
    if (!db || !repo) return;
    const events = async () =>
      (
        await db
          .select({
            type: identityLifecycleOutbox.eventType,
            payload: identityLifecycleOutbox.payload,
          })
          .from(identityLifecycleOutbox)
          .where(eq(identityLifecycleOutbox.aggregateId, dueId))
      ).filter((e) => e.type === "user.deletion_held");

    await expect(repo.recordHold({ subjectId: dueId, reasons: REASONS, now })).resolves.toBe("new");
    await expect(repo.recordHold({ subjectId: dueId, reasons: REASONS, now })).resolves.toBe(
      "unchanged",
    );
    expect(await events()).toHaveLength(1);

    const more = [
      ...REASONS,
      { code: "shop_open_orders", message: "An order is open.", href: null },
    ];
    await expect(repo.recordHold({ subjectId: dueId, reasons: more, now })).resolves.toBe(
      "changed",
    );
    expect(await events()).toHaveLength(2);

    const [row] = await db.select().from(user).where(eq(user.id, dueId));
    expect(row?.deletionHeldAt).toEqual(now);
    expect(row?.deletionHoldReasons).toEqual(more);
    // Held people keep every detail.
    expect(row?.email).toBe(`${dueId}@example.com`);
  });

  it("erases the person, keeps their address only in the outbox, and publishes the event", async () => {
    if (!db || !repo) return;
    await repo.recordHold({ subjectId: dueId, reasons: REASONS, now });

    await expect(repo.purge({ subjectId: dueId, cutoff, now })).resolves.toBe(true);
    await expect(repo.purge({ subjectId: dueId, cutoff, now })).resolves.toBe(false);

    const [row] = await db.select().from(user).where(eq(user.id, dueId));
    expect(row).toMatchObject({
      name: "[deleted]",
      email: `deleted+${dueId}@purged.invalid`,
      image: null,
      deletionHeldAt: null,
      deletionHoldReasons: null,
    });
    const jobs = await db
      .select()
      .from(authSecurityEffectOutbox)
      .where(eq(authSecurityEffectOutbox.userId, dueId));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      kind: "send_account_deleted_notice",
      status: "pending",
      attemptCount: 0,
    });
    expect(jobs[0]?.payload).toMatchObject({ email: `${dueId}@example.com`, userId: dueId });
    const deleted = (
      await db
        .select({ type: identityLifecycleOutbox.eventType })
        .from(identityLifecycleOutbox)
        .where(eq(identityLifecycleOutbox.aggregateId, dueId))
    ).filter((e) => e.type === "user.identity_deleted");
    expect(deleted).toHaveLength(1);
  });

  it("does not erase someone who is still inside the grace period or who cancelled", async () => {
    if (!repo) return;
    await expect(repo.purge({ subjectId: coolingId, cutoff, now })).resolves.toBe(false);
  });

  it("sends the confirmation to the copied address, then no longer holds it", async () => {
    if (!db || !repo) return;
    await repo.purge({ subjectId: dueId, cutoff, now });
    const deliver = vi.fn(async () => undefined);
    const effects = new DurableSecurityEffects(
      new DrizzleSecurityEffectOutboxRepository(db),
      {
        operations: {} as never,
        logout: {} as never,
        events: {} as never,
        notices: { deliver },
      },
      { warn: vi.fn(), error: vi.fn() },
      () => now,
    );

    await expect(effects.drain()).resolves.toBeGreaterThanOrEqual(1);

    expect(deliver).toHaveBeenCalledWith({
      kind: "account_deletion_completed",
      userId: dueId,
      at: now,
      email: `${dueId}@example.com`,
    });
    const left = await db
      .select()
      .from(authSecurityEffectOutbox)
      .where(eq(authSecurityEffectOutbox.userId, dueId));
    expect(left).toEqual([]);
  });

  it("keeps no address in a job that is abandoned", async () => {
    if (!db || !repo) return;
    await repo.purge({ subjectId: dueId, cutoff, now });
    const outbox = new DrizzleSecurityEffectOutboxRepository(db);
    const [job] = await db
      .select()
      .from(authSecurityEffectOutbox)
      .where(eq(authSecurityEffectOutbox.userId, dueId));

    await outbox.abandon({ id: job?.id as string, attemptCount: 6, error: "mail down", now });

    const [after] = await db
      .select()
      .from(authSecurityEffectOutbox)
      .where(eq(authSecurityEffectOutbox.userId, dueId));
    expect(after?.status).toBe("abandoned");
    expect(JSON.stringify(after?.payload)).not.toContain("@example.com");
  });

  it("queues the reminder once, for people within a week who are not held or due", async () => {
    if (!repo) return;
    const remindBefore = new Date(now.getTime() - 23 * DAY);
    const claim = () => repo.claimReminders({ now, cutoff, remindBefore, limit: 50 });

    const first = (await claim()).map((s) => s.id).filter((id) => ids.includes(id as never));
    const second = (await claim()).map((s) => s.id).filter((id) => ids.includes(id as never));

    expect(first).toEqual([coolingId, weekOutId]);
    expect(second).toEqual([]);
  });

  it("clears the hold and re-arms the reminder when the person cancels", async () => {
    if (!db) return;
    const subjects = new DrizzleIdentitySubjectRepository(db);
    await db
      .update(user)
      .set({ deletionReminderSentAt: now, deletionHoldReasons: [...REASONS] })
      .where(eq(user.id, heldId));

    await subjects.cancelDeletionRequested(null, heldId, now);

    const [row] = await db.select().from(user).where(eq(user.id, heldId));
    expect(row).toMatchObject({
      deletionRequestedAt: null,
      deletionHeldAt: null,
      deletionHoldReasons: null,
      deletionReminderSentAt: null,
    });
  });
});
