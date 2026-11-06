import { randomUUID } from "node:crypto";
import { alertRetentionCutoffs } from "@auction/alerts";
import { createDb } from "@auction/db";
import {
  bidAlertDigest,
  bidAlertMatch,
  bidAlertSubscriber,
  bidAlertTopic,
  emailSuppression,
  visitorSaleAlertSubscriber,
} from "@auction/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createBidAlertRetentionStores } from "./bid-alert-retention.stores.js";

const url = process.env.DATABASE_URL;
const HAS_DB = Boolean(url);
// biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
const db = HAS_DB ? createDb(url!) : (null as never);

const NOW = new Date("2026-11-06T03:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const cutoffs = alertRetentionCutoffs(NOW);
const [bidStore, visitorStore] = HAS_DB ? createBidAlertRetentionStores(db) : [];

async function clean() {
  for (const table of [
    "bid_alert_match",
    "bid_alert_digest",
    "bid_alert_topic",
    "bid_alert_announcement",
    "bid_alert_subscriber",
    "visitor_sale_alert_subscriber",
  ]) {
    await db.execute(sql.raw(`DELETE FROM ${table}`));
  }
}

async function subscriber(
  label: string,
  fields: Partial<typeof bidAlertSubscriber.$inferInsert> = {},
) {
  const [row] = await db
    .insert(bidAlertSubscriber)
    .values({
      product: "bid",
      email: `${label}-${randomUUID()}@example.test`,
      status: "confirmed",
      consentText: "consent",
      consentSource: "test",
      requestedAt: ago(200),
      ...fields,
    })
    .returning();
  if (!row) throw new Error("insert failed");
  await db
    .insert(bidAlertTopic)
    .values({ subscriberId: row.id, topic: "bid.new_sales", emailOn: true });
  return row.id;
}

async function digest(subscriberId: string, createdAt: Date, sentAt: Date | null) {
  const [row] = await db
    .insert(bidAlertDigest)
    .values({
      subscriberId,
      product: "bid",
      localDate: createdAt.toISOString().slice(0, 10),
      itemCount: 1,
      outboxIdempotencyKey: randomUUID(),
      sentAt,
      createdAt,
    })
    .returning({ id: bidAlertDigest.id });
  if (!row) throw new Error("insert failed");
  return row.id;
}

async function match(
  subscriberId: string,
  matchedAt: Date,
  link: { digestId?: string; droppedReason?: string } = {},
) {
  const [row] = await db
    .insert(bidAlertMatch)
    .values({
      subscriberId,
      topic: "bid.new_sales",
      itemKey: `sale:${randomUUID()}`,
      snapshot: {},
      matchedAt,
      digestId: link.digestId ?? null,
      droppedReason: link.droppedReason ?? null,
    })
    .returning({ id: bidAlertMatch.id });
  if (!row) throw new Error("insert failed");
  return row.id;
}

const present = async (table: typeof bidAlertSubscriber, ids: string[]) =>
  (await db.select({ id: table.id }).from(table).where(inArray(table.id, ids))).map((r) => r.id);

describe.skipIf(!HAS_DB)("Bid alert retention prune (DB)", () => {
  it("deletes stale pending and stopped subscribers and nothing active", async () => {
    await clean();
    const active = await subscriber("active", { status: "confirmed", confirmedAt: ago(150) });
    const pendingOld = await subscriber("pending-old", { status: "pending", requestedAt: ago(40) });
    const pendingNew = await subscriber("pending-new", { status: "pending", requestedAt: ago(10) });
    const stoppedOld = await subscriber("stopped-old", {
      status: "stopped",
      stopReason: "link",
      stoppedAt: ago(40),
    });
    const stoppedNew = await subscriber("stopped-new", {
      status: "stopped",
      stopReason: "link",
      stoppedAt: ago(10),
    });
    const stoppedNoDate = await subscriber("stopped-nodate", {
      status: "stopped",
      stopReason: "settings",
      stoppedAt: null,
      updatedAt: ago(40),
    });

    const counts = await bidStore?.prune(cutoffs, { dryRun: false });

    expect(counts).toMatchObject({ unconfirmed: 1, stopped: 2 });
    const left = await present(bidAlertSubscriber, [
      active,
      pendingOld,
      pendingNew,
      stoppedOld,
      stoppedNew,
      stoppedNoDate,
    ]);
    expect(left.sort()).toEqual([active, pendingNew, stoppedNew].sort());
    // The topic of a deleted subscriber went by cascade; the active one's switch is intact.
    const topics = await db
      .select()
      .from(bidAlertTopic)
      .where(eq(bidAlertTopic.subscriberId, active));
    expect(topics).toHaveLength(1);
  });

  it("keeps a complaint-stopped row and trims what is under it", async () => {
    await clean();
    const complained = await subscriber("complained", {
      status: "stopped",
      stopReason: "complaint",
      stoppedAt: ago(40),
    });
    const complainedRecent = await subscriber("complained-recent", {
      status: "stopped",
      stopReason: "complaint",
      stoppedAt: ago(5),
    });
    const sent = await digest(complained, ago(50), ago(50));
    await match(complained, ago(50), { digestId: sent });
    await match(complained, ago(3));
    const keptDigest = await digest(complainedRecent, ago(5), ago(5));
    await match(complainedRecent, ago(5), { digestId: keptDigest });

    const counts = await bidStore?.prune(cutoffs, { dryRun: false });

    expect(counts?.stopped).toBe(0);
    expect(counts?.suppressionsTrimmed).toBe(1);
    expect(await present(bidAlertSubscriber, [complained, complainedRecent])).toHaveLength(2);
    const row = await db
      .select()
      .from(bidAlertSubscriber)
      .where(eq(bidAlertSubscriber.id, complained));
    expect(row[0]).toMatchObject({ status: "stopped", stopReason: "complaint" });
    for (const table of [bidAlertTopic, bidAlertMatch, bidAlertDigest]) {
      expect(await db.select().from(table).where(eq(table.subscriberId, complained))).toHaveLength(
        0,
      );
      expect(
        await db.select().from(table).where(eq(table.subscriberId, complainedRecent)),
      ).not.toHaveLength(0);
    }
  });

  it("removes old settled logs and keeps recent, waiting and unsent ones", async () => {
    await clean();
    const sub = await subscriber("logs");
    const oldSent = await digest(sub, ago(400), ago(400));
    const oldUnsent = await digest(sub, ago(401), null);
    const recentSent = await digest(sub, ago(30), ago(30));
    const oldMatchSent = await match(sub, ago(400), { digestId: oldSent });
    const oldMatchDropped = await match(sub, ago(400), { droppedReason: "stale" });
    const oldMatchWaiting = await match(sub, ago(400));
    const oldMatchInUnsent = await match(sub, ago(400), { digestId: oldUnsent });
    const recentMatch = await match(sub, ago(30), { digestId: recentSent });

    const counts = await bidStore?.prune(cutoffs, { dryRun: false });

    expect(counts).toMatchObject({ matches: 2, digests: 1 });
    const matches = (await db.select({ id: bidAlertMatch.id }).from(bidAlertMatch)).map(
      (r) => r.id,
    );
    expect(matches.sort()).toEqual([oldMatchWaiting, oldMatchInUnsent, recentMatch].sort());
    const digests = (await db.select({ id: bidAlertDigest.id }).from(bidAlertDigest)).map(
      (r) => r.id,
    );
    expect(digests.sort()).toEqual([oldUnsent, recentSent].sort());
    expect(oldMatchSent).not.toBe(oldMatchDropped);
    // The waiting match was not turned loose by a digest delete.
    const waiting = await db
      .select()
      .from(bidAlertMatch)
      .where(eq(bidAlertMatch.id, oldMatchInUnsent));
    expect(waiting[0]?.digestId).toBe(oldUnsent);
    expect(await present(bidAlertSubscriber, [sub])).toEqual([sub]);
  });

  it("deletes nothing in a dry run, and counts what it would", async () => {
    await clean();
    const pending = await subscriber("dry", { status: "pending", requestedAt: ago(40) });
    const counts = await bidStore?.prune(cutoffs, { dryRun: true });
    expect(counts?.unconfirmed).toBe(1);
    expect(await present(bidAlertSubscriber, [pending])).toEqual([pending]);
  });

  it("is idempotent and handles more rows than one batch", async () => {
    await clean();
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      ids.push(await subscriber(`bulk-${i}`, { status: "pending", requestedAt: ago(40) }));
    }
    const small = createBidAlertRetentionStores(db);
    expect(small).toHaveLength(2);
    const first = await bidStore?.prune(cutoffs, { dryRun: false });
    const second = await bidStore?.prune(cutoffs, { dryRun: false });
    expect(first?.unconfirmed).toBe(3);
    expect(second).toEqual({
      unconfirmed: 0,
      stopped: 0,
      suppressionsTrimmed: 0,
      matches: 0,
      digests: 0,
    });
  });

  it("leaves the address-level email suppression list alone", async () => {
    await clean();
    const emailHash = `retention-test-${randomUUID()}`;
    await db.insert(emailSuppression).values({ emailHash, reason: "complaint" });
    await subscriber("supp", { status: "stopped", stopReason: "complaint", stoppedAt: ago(400) });
    await subscriber("supp2", { status: "pending", requestedAt: ago(400) });
    await bidStore?.prune(cutoffs, { dryRun: false });
    const rows = await db
      .select()
      .from(emailSuppression)
      .where(eq(emailSuppression.emailHash, emailHash));
    expect(rows).toHaveLength(1);
    await db.delete(emailSuppression).where(eq(emailSuppression.emailHash, emailHash));
  });
});

describe.skipIf(!HAS_DB)("Visitor sale alert retention prune (DB)", () => {
  const visitor = async (
    status: "pending" | "confirmed" | "unsubscribed",
    fields: Partial<typeof visitorSaleAlertSubscriber.$inferInsert> = {},
  ) => {
    const [row] = await db
      .insert(visitorSaleAlertSubscriber)
      .values({
        email: `v-${randomUUID()}@example.test`,
        status,
        consentText: "consent",
        consentSource: "test",
        requestedAt: ago(200),
        ...fields,
      })
      .returning({ id: visitorSaleAlertSubscriber.id });
    if (!row) throw new Error("insert failed");
    return row.id;
  };

  it("removes stale pending and unsubscribed addresses and keeps confirmed ones", async () => {
    await clean();
    const confirmed = await visitor("confirmed", { confirmedAt: ago(150) });
    const pendingOld = await visitor("pending", { requestedAt: ago(40) });
    const pendingNew = await visitor("pending", { requestedAt: ago(5) });
    const goneOld = await visitor("unsubscribed", { unsubscribedAt: ago(40) });
    const goneNew = await visitor("unsubscribed", { unsubscribedAt: ago(5) });

    const counts = await visitorStore?.prune(cutoffs, { dryRun: false });

    expect(counts).toMatchObject({ unconfirmed: 1, stopped: 1 });
    const ids = [confirmed, pendingOld, pendingNew, goneOld, goneNew];
    const left = (
      await db
        .select({ id: visitorSaleAlertSubscriber.id })
        .from(visitorSaleAlertSubscriber)
        .where(inArray(visitorSaleAlertSubscriber.id, ids))
    ).map((r) => r.id);
    expect(left.sort()).toEqual([confirmed, pendingNew, goneNew].sort());
  });
});
