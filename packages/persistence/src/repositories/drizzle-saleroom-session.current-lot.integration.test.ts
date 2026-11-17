import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { saleroomSession } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleSaleroomSessionRepository } from "./drizzle-saleroom-session.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The clerk's lot outcome takes the lot off the block with a compare-and-clear. These tests commit
 * real rows from separate connections, because the point is an advance racing the outcome.
 */
describe.skipIf(!HAS_DB)("saleroom session current lot (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const userId = `saleroom-it-${run}`;
  const entityId = randomUUID();
  const saleIds: string[] = [];
  const lotIds: string[] = [];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleSaleroomSessionRepository(db);

  /** A live session on a fresh sale with two lots, lot A on the block. */
  async function liveSessionOnA() {
    const saleId = randomUUID();
    await db.execute(sql`
      insert into sale (id, title, start_time, end_time, created_by_legal_entity_id)
      values (${saleId}, 'Saleroom IT sale', now(), now() + interval '1 day', ${entityId})`);
    saleIds.push(saleId);
    const created = await db.execute<{ id: string }>(sql`
      insert into lot (id, sale_id, seller_legal_entity_id, title, auction_type, starting_price,
         current_price, start_time, end_time, status)
      select gen_random_uuid(), ${saleId}::uuid, ${entityId}::uuid, 'Saleroom IT lot ' || n,
         'english', 100, 100, now(), now() + interval '1 day', 'active'
      from generate_series(1, 2) as n
      returning id`);
    const [lotA, lotB] = created.rows.map((row) => row.id) as [string, string];
    lotIds.push(lotA, lotB);
    const session = await repo.upsertPending(saleId, userId);
    await repo.markLive({ sessionId: session.id, clerkUserId: userId, startedAt: new Date() });
    await repo.setCurrentLot(session.id, lotA);
    return { sessionId: session.id, lotA, lotB };
  }

  async function currentLotOf(sessionId: string) {
    const [row] = await db
      .select({ currentLotId: saleroomSession.currentLotId })
      .from(saleroomSession)
      .where(eq(saleroomSession.id, sessionId));
    return row?.currentLotId ?? null;
  }

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'Clerk', ${`${userId}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Saleroom IT seller', 'individual', 'private_collector', ${userId}, 'approved')`);
  });

  afterAll(async () => {
    for (const saleId of saleIds) {
      await db.execute(sql`delete from saleroom_session where sale_id = ${saleId}`);
    }
    await db.execute(sql`delete from lot where seller_legal_entity_id = ${entityId}`);
    for (const saleId of saleIds) {
      await db.execute(sql`delete from sale where id = ${saleId}`);
    }
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(sql`delete from "user" where id = ${userId}`);
  });

  it("clears the current lot when the resolved lot is the one on the block", async () => {
    const { sessionId, lotA } = await liveSessionOnA();

    await expect(repo.clearCurrentLotIfCurrent({ sessionId, lotId: lotA })).resolves.toEqual({
      cleared: true,
    });
    expect(await currentLotOf(sessionId)).toBeNull();
  });

  it("leaves the current lot when a different lot is resolved", async () => {
    const { sessionId, lotA, lotB } = await liveSessionOnA();
    await repo.setCurrentLot(sessionId, lotB);

    await expect(repo.clearCurrentLotIfCurrent({ sessionId, lotId: lotA })).resolves.toEqual({
      cleared: false,
    });
    expect(await currentLotOf(sessionId)).toBe(lotB);
  });

  it("an advance committed while the outcome transaction is open survives the outcome's clear", async () => {
    const { sessionId, lotA, lotB } = await liveSessionOnA();

    await db.transaction(async (tx) => {
      // The outcome transaction has started (and holds the lot lock) when the advance commits.
      await tx.execute(sql`select id from lot where id = ${lotA} for update`);
      await repo.setCurrentLot(sessionId, lotB);
      const result = await repo.clearCurrentLotIfCurrent({ sessionId, lotId: lotA }, tx);
      expect(result).toEqual({ cleared: false });
    });

    expect(await currentLotOf(sessionId)).toBe(lotB);
  });

  it("an advance that arrives after the clear waits for the outcome to commit, then wins", async () => {
    const { sessionId, lotA, lotB } = await liveSessionOnA();

    let advance: Promise<void> | undefined;
    await db.transaction(async (tx) => {
      const result = await repo.clearCurrentLotIfCurrent({ sessionId, lotId: lotA }, tx);
      expect(result).toEqual({ cleared: true });
      // The session row is locked by the clear until this transaction commits.
      advance = repo.setCurrentLot(sessionId, lotB);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    await advance;

    expect(await currentLotOf(sessionId)).toBe(lotB);
  });
});
