import { randomUUID } from "node:crypto";
import { alertRetentionCutoffs } from "@auction/alerts";
import {
  shopAlertDigest,
  shopAlertMatch,
  shopAlertSubscriber,
  shopAlertTopic,
} from "@auction/db/schema";
import { createShopAlertRetentionStore } from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";

const NOW = new Date("2026-11-06T03:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const cutoffs = alertRetentionCutoffs(NOW);

let pools: { ownerPool: pg.Pool; shopPool: pg.Pool } | null = null;

afterAll(async () => {
  if (!pools) return;
  await pools.shopPool.end();
  await pools.ownerPool.end();
});

describe.skipIf(!hasShopIntegrationDb)("Shop alert retention prune (DB, as shop_app)", () => {
  async function setup() {
    pools ??= await setupShopIntegrationPools();
    await pools.ownerPool.query(
      "TRUNCATE shop_alert_match, shop_alert_digest, shop_alert_topic, shop_alert_subscriber, shop_alert_announcement CASCADE",
    );
    const db = createShopDb(pools.shopPool);
    const add = async (
      product: "shop" | "art",
      fields: Partial<typeof shopAlertSubscriber.$inferInsert>,
    ) => {
      const [row] = await db
        .insert(shopAlertSubscriber)
        .values({
          product,
          email: `${randomUUID()}@example.test`,
          status: "confirmed",
          consentText: "consent",
          consentSource: "test",
          requestedAt: ago(200),
          ...fields,
        })
        .returning({ id: shopAlertSubscriber.id });
      if (!row) throw new Error("insert failed");
      await db
        .insert(shopAlertTopic)
        .values({ subscriberId: row.id, topic: "shop.releases", emailOn: true });
      return row.id;
    };
    return { db, add, store: createShopAlertRetentionStore(db) };
  }

  const alive = async (db: ReturnType<typeof createShopDb>, ids: string[]) =>
    (
      await db
        .select({ id: shopAlertSubscriber.id })
        .from(shopAlertSubscriber)
        .where(inArray(shopAlertSubscriber.id, ids))
    ).map((r) => r.id);

  it("prunes Shop and lax.art rows by the rules and never an active subscriber", async () => {
    const { db, add, store } = await setup();
    const active = await add("shop", { confirmedAt: ago(150) });
    const activeArt = await add("art", { confirmedAt: ago(150) });
    const pendingOld = await add("art", { status: "pending", requestedAt: ago(45) });
    const pendingNew = await add("shop", { status: "pending", requestedAt: ago(3) });
    const stoppedOld = await add("shop", {
      status: "stopped",
      stopReason: "one_click",
      stoppedAt: ago(31),
    });
    const stoppedNew = await add("shop", {
      status: "stopped",
      stopReason: "one_click",
      stoppedAt: ago(29),
    });

    const counts = await store.prune(cutoffs, { dryRun: false });

    expect(counts).toMatchObject({ unconfirmed: 1, stopped: 1 });
    const left = await alive(db, [
      active,
      activeArt,
      pendingOld,
      pendingNew,
      stoppedOld,
      stoppedNew,
    ]);
    expect(left.sort()).toEqual([active, activeArt, pendingNew, stoppedNew].sort());
  });

  it("keeps the complaint-stopped row, detached from the account, with its children gone", async () => {
    const { db, add, store } = await setup();
    const complained = await add("shop", {
      status: "stopped",
      stopReason: "complaint",
      stoppedAt: ago(60),
      subjectId: "subject-1",
    });
    const [d] = await db
      .insert(shopAlertDigest)
      .values({
        subscriberId: complained,
        product: "shop",
        localDate: "2026-09-01",
        itemCount: 1,
        outboxIdempotencyKey: randomUUID(),
        sentAt: ago(60),
        createdAt: ago(60),
      })
      .returning({ id: shopAlertDigest.id });
    await db.insert(shopAlertMatch).values({
      subscriberId: complained,
      topic: "shop.releases",
      itemKey: "artwork:1",
      snapshot: {},
      digestId: d?.id,
    });

    const counts = await store.prune(cutoffs, { dryRun: false });

    expect(counts.stopped).toBe(0);
    expect(counts.suppressionsTrimmed).toBe(1);
    const [row] = await db
      .select()
      .from(shopAlertSubscriber)
      .where(eq(shopAlertSubscriber.id, complained));
    expect(row).toMatchObject({ status: "stopped", stopReason: "complaint", subjectId: null });
    for (const table of [shopAlertTopic, shopAlertMatch, shopAlertDigest]) {
      expect(await db.select().from(table).where(eq(table.subscriberId, complained))).toHaveLength(
        0,
      );
    }
  });

  it("removes only old sent digests and settled matches", async () => {
    const { db, add, store } = await setup();
    const sub = await add("shop", { confirmedAt: ago(300) });
    const digestRow = (createdAt: Date, sentAt: Date | null, day: string) =>
      db
        .insert(shopAlertDigest)
        .values({
          subscriberId: sub,
          product: "shop",
          localDate: day,
          itemCount: 1,
          outboxIdempotencyKey: randomUUID(),
          sentAt,
          createdAt,
        })
        .returning({ id: shopAlertDigest.id });
    const [oldSent] = await digestRow(ago(400), ago(400), "2025-09-01");
    const [recent] = await digestRow(ago(20), ago(20), "2026-10-16");
    const matchRow = (
      matchedAt: Date,
      extra: { digestId?: string | undefined; droppedReason?: string },
    ) =>
      db
        .insert(shopAlertMatch)
        .values({
          subscriberId: sub,
          topic: "shop.releases",
          itemKey: `artwork:${randomUUID()}`,
          snapshot: {},
          matchedAt,
          ...extra,
        })
        .returning({ id: shopAlertMatch.id });
    await matchRow(ago(400), { digestId: oldSent?.id });
    const [waiting] = await matchRow(ago(400), {});
    const [fresh] = await matchRow(ago(20), { digestId: recent?.id });

    const counts = await store.prune(cutoffs, { dryRun: false });

    expect(counts).toMatchObject({ matches: 1, digests: 1 });
    const matches = (await db.select({ id: shopAlertMatch.id }).from(shopAlertMatch)).map(
      (r) => r.id,
    );
    expect(matches.sort()).toEqual([waiting?.id, fresh?.id].sort());
    expect(await alive(db, [sub])).toEqual([sub]);
  });
});
