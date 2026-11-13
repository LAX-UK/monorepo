import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { legalEntity, payout, user } from "@auction/db/schema";
import { TRANSFER_OUTCOME_UNKNOWN_PREFIX } from "@auction/domain";
import type { PayoutStatus } from "@auction/types";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * `lockOpenPayoutsForEntities`: a transaction that moves several sellers' payouts holds them in one
 * global order (legal entity id, then payout id) before it changes any.
 */
describe.skipIf(!HAS_DB)("DrizzlePayoutRepository payout lock order (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const url = process.env.DATABASE_URL!;
  const db = createDb(url);
  const userId = `payout-lock-order-${randomUUID()}`;
  const entityIds: string[] = [];

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      name: "Payout Lock Order",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    if (entityIds.length > 0) {
      await db.delete(payout).where(inArray(payout.legalEntityId, entityIds));
      await db.delete(legalEntity).where(inArray(legalEntity.id, entityIds));
    }
    await db.delete(user).where(eq(user.id, userId));
  });

  /** Two sellers, the first with the lower id. */
  async function twoSellers(): Promise<[string, string]> {
    const ids = [randomUUID(), randomUUID()].sort() as [string, string];
    const now = new Date();
    await db.insert(legalEntity).values(
      ids.map((id) => ({
        id,
        displayName: "Payout Lock Order Entity",
        kind: "individual" as const,
        subkind: "private_collector" as const,
        createdByUserId: userId,
        status: "approved" as const,
        createdAt: now,
        updatedAt: now,
      })),
    );
    entityIds.push(...ids);
    return ids;
  }

  async function seedPayout(
    legalEntityId: string,
    status: PayoutStatus = "scheduled",
    failureReason: string | null = null,
  ): Promise<string> {
    const periodEnd = new Date();
    const [row] = await db
      .insert(payout)
      .values({
        legalEntityId,
        periodStart: new Date(periodEnd.getTime() - 86_400_000),
        periodEnd,
        grossAmount: "100.00",
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: "100.00",
        status,
        failureReason,
      })
      .returning({ id: payout.id });
    if (!row) throw new Error("seed_payout_failed");
    return row.id;
  }

  /** Another connection asking for the payout without waiting: refused while the row is held. */
  async function payoutIsHeld(payoutId: string): Promise<boolean> {
    const other = createDb(url);
    return other
      .transaction((tx) =>
        tx.execute(sql`SELECT id FROM payout WHERE id = ${payoutId} FOR UPDATE NOWAIT`),
      )
      .then(
        () => false,
        () => true,
      );
  }

  /** Waits until some connection is queued for a payout row lock. */
  async function someoneWaitsForAPayout(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      const rows = await db.execute(
        sql`SELECT 1 FROM pg_stat_activity
            WHERE wait_event_type = 'Lock' AND query ILIKE '%from "payout"%for update%'`,
      );
      if (rows.rows.length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("no connection queued for a payout lock");
  }

  /** Holds the payout's row from another connection until `release` is called. */
  function holdPayout(payoutId: string) {
    const holder = createDb(url);
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held!: () => void;
    const isHeld = new Promise<void>((resolve) => {
      held = resolve;
    });
    const done = holder.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM payout WHERE id = ${payoutId} FOR UPDATE`);
      held();
      await released;
    });
    return { isHeld, release, done };
  }

  it("holds the lower seller's payout while it waits for the higher seller's", async () => {
    const [lower, higher] = await twoSellers();
    const lowerPayout = await seedPayout(lower);
    const higherPayout = await seedPayout(higher);
    const other = holdPayout(higherPayout);
    await other.isHeld;

    const locker = createDb(url);
    let lowerHeldWhileWaiting: boolean | null = null;
    const locking = locker.transaction(async (tx) => {
      // Asked for in the opposite order: the order the rows are held in is the repository's.
      await new DrizzlePayoutRepository(tx as unknown as Database).lockOpenPayoutsForEntities([
        higher,
        lower,
      ]);
    });
    await someoneWaitsForAPayout();
    lowerHeldWhileWaiting = await payoutIsHeld(lowerPayout);
    other.release();
    await other.done;
    await locking;

    expect(lowerHeldWhileWaiting).toBe(true);
  });

  it("holds one seller's payouts in payout id order", async () => {
    const [seller] = await twoSellers();
    const ids = [await seedPayout(seller), await seedPayout(seller)].sort();
    const [first, second] = ids as [string, string];
    const other = holdPayout(second);
    await other.isHeld;

    const locker = createDb(url);
    const locking = locker.transaction(async (tx) => {
      await new DrizzlePayoutRepository(tx as unknown as Database).lockOpenPayoutsForEntities([
        seller,
      ]);
    });
    await someoneWaitsForAPayout();
    const firstHeldWhileWaiting = await payoutIsHeld(first);
    other.release();
    await other.done;
    await locking;

    expect(firstHeldWhileWaiting).toBe(true);
  });

  it("holds only payouts that can take lines", async () => {
    const [seller] = await twoSellers();
    const open = await seedPayout(seller);
    const inTransit = await seedPayout(seller, "in_transit");
    const unknown = await seedPayout(
      seller,
      "scheduled",
      `${TRANSFER_OUTCOME_UNKNOWN_PREFIX} unknown - socket hang up`,
    );

    const held: Record<string, boolean> = {};
    await createDb(url).transaction(async (tx) => {
      await new DrizzlePayoutRepository(tx as unknown as Database).lockOpenPayoutsForEntities([
        seller,
      ]);
      for (const id of [open, inTransit, unknown]) held[id] = await payoutIsHeld(id);
    });

    expect(held).toEqual({ [open]: true, [inTransit]: false, [unknown]: false });
  });
});
