import type { Database } from "@auction/db";
import {
  shopAdminAudit,
  shopAlertAnnouncement,
  shopAlertDigest,
  shopAlertMatch,
  shopAlertSubscriber,
  shopArtwork,
  shopUserProfile,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artworkItemKey } from "../../application/alerts/alert-items.js";
import { importTestArtwork } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { ReleaseAlertSendLogStore } from "./release-alert-send-log.store.js";

let pools: { ownerPool: pg.Pool; shopPool: pg.Pool } | null = null;

async function ensurePools() {
  pools ??= await setupShopIntegrationPools();
  return pools;
}

afterAll(async () => {
  if (!pools) return;
  await pools.shopPool.end();
  await pools.ownerPool.end();
});

const HOUR = 60 * 60 * 1000;
const NOW = new Date();
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const consent = { consentText: "We'll email you.", consentSource: "shop_home" };

let seq = 0;
async function subscriber(db: Database) {
  seq += 1;
  const [row] = await db
    .insert(shopAlertSubscriber)
    .values({
      product: "shop",
      email: `send-log-${Date.now()}-${seq}@example.com`,
      status: "confirmed",
      requestedAt: ago(30 * 24 * HOUR),
      confirmedAt: ago(30 * 24 * HOUR),
      ...consent,
    })
    .returning({ id: shopAlertSubscriber.id });
  if (!row) throw new Error("subscriber fixture missing");
  return row.id;
}

async function digest(db: Database, subscriberId: string, opts: { sent: boolean; madeAt: Date }) {
  const [row] = await db
    .insert(shopAlertDigest)
    .values({
      subscriberId,
      product: "shop",
      localDate: opts.madeAt.toISOString().slice(0, 10),
      itemCount: 1,
      outboxIdempotencyKey: `send-log-${subscriberId}`,
      sentAt: opts.sent ? opts.madeAt : null,
      createdAt: opts.madeAt,
    })
    .returning({ id: shopAlertDigest.id });
  if (!row) throw new Error("digest fixture missing");
  return row.id;
}

type MatchKind = "emailed" | "waiting" | "stuck" | { dropped: string };

/** One person matched to the release, in the state named. */
async function match(db: Database, itemKey: string, kind: MatchKind, topic = "shop.releases") {
  const subscriberId = await subscriber(db);
  const digestId =
    kind === "emailed"
      ? await digest(db, subscriberId, { sent: true, madeAt: ago(2 * HOUR) })
      : kind === "stuck"
        ? await digest(db, subscriberId, { sent: false, madeAt: ago(30 * HOUR) })
        : null;
  await db.insert(shopAlertMatch).values({
    subscriberId,
    topic,
    itemKey,
    snapshot: { title: "fixture", path: "/artworks/fixture" },
    matchedAt: ago(3 * HOUR),
    digestId,
    droppedReason: typeof kind === "object" ? kind.dropped : null,
  });
}

async function announce(
  db: Database,
  artworkId: string,
  at: Date,
  opts: { announce?: boolean; expanded?: boolean } = {},
) {
  await db.insert(shopAlertAnnouncement).values({
    itemKey: artworkItemKey(artworkId),
    announcedAt: at,
    announce: opts.announce ?? true,
    expandedAt: opts.expanded === false ? null : at,
  });
}

async function publishAudit(db: Database, artworkId: string, actor: string, at: Date) {
  await db.insert(shopAdminAudit).values({
    actorSubjectId: actor,
    capability: "catalogue.publish",
    action: "publish_artwork",
    targetType: "shop_artwork",
    targetId: artworkId,
    createdAt: at,
  });
}

describe.skipIf(!hasShopIntegrationDb)("ReleaseAlertSendLogStore (integration)", () => {
  let db: Database;
  let shopPool: pg.Pool;
  const ids: Record<string, string> = {};

  const clearAlerts = async () =>
    (await ensurePools()).ownerPool.query(
      "TRUNCATE shop_alert_match, shop_alert_digest, shop_alert_topic, shop_alert_subscriber, shop_alert_announcement CASCADE",
    );

  // Left behind, the queued release would be picked up by another suite's matching run.
  afterEach(clearAlerts);

  beforeEach(async () => {
    shopPool = (await ensurePools()).shopPool;
    await clearAlerts();
    db = createShopDb(shopPool);
    for (const label of ["quiet", "queued", "sending", "stuck", "sent", "tie"]) {
      ids[label] = (await importTestArtwork(db, `send-log-${label}`)).artworkId;
    }
    const original = await importTestArtwork(db, "send-log-not-edition");
    ids.notEdition = original.artworkId;
    await db
      .update(shopArtwork)
      .set({ eligibleForEditionAllocation: false })
      .where(eq(shopArtwork.id, original.artworkId));

    const key = (label: string) => artworkItemKey(ids[label] as string);
    // Newest first: sent, tie (same instant as sent), stuck, sending, queued, quiet.
    await announce(db, ids.quiet as string, ago(60 * HOUR), { announce: false });
    await announce(db, ids.queued as string, ago(50 * HOUR), { expanded: false });
    await announce(db, ids.sending as string, ago(40 * HOUR));
    await announce(db, ids.stuck as string, ago(35 * HOUR));
    await announce(db, ids.sent as string, ago(20 * HOUR));
    await announce(db, ids.tie as string, ago(20 * HOUR));
    await announce(db, ids.notEdition as string, ago(10 * HOUR));

    await match(db, key("sending"), "emailed");
    await match(db, key("sending"), "waiting");
    await match(db, key("sending"), { dropped: "topic_off" });
    // Another topic's match for the same work is not part of the release alert.
    await match(db, key("sending"), "emailed", "shop.back_in_stock");
    await match(db, key("stuck"), "stuck");
    await match(db, key("stuck"), "emailed");
    await match(db, key("sent"), "emailed");
    await match(db, key("sent"), "emailed");
    await match(db, key("sent"), { dropped: "withdrawn" });
    await match(db, key("sent"), { dropped: "topic_off" });
    await match(db, key("sent"), { dropped: "topic_off" });

    const subject = `send-log-publisher-${Date.now()}`;
    const other = `send-log-republisher-${Date.now()}`;
    await db.insert(shopUserProfile).values([
      { identitySubjectId: subject, email: `${subject}@example.com`, name: " Sam Example " },
      { identitySubjectId: other, email: `${other}@example.com`, name: "Alex Example" },
    ]);
    await publishAudit(db, ids.sending as string, subject, ago(40 * HOUR));
    // A later republish by someone else does not replace who published the release.
    await publishAudit(db, ids.sending as string, other, ago(5 * HOUR));
  });

  const store = () =>
    new ReleaseAlertSendLogStore(
      db,
      (v) => v ?? null,
      () => NOW,
    );

  it("lists published edition releases newest first with counts and a status each", async () => {
    const { items, nextCursor } = await store().list({});
    expect(nextCursor).toBeNull();
    const byId = new Map(items.map((item) => [item.artworkId, item]));
    expect(items).toHaveLength(6);
    expect(byId.has(ids.notEdition as string)).toBe(false);
    expect(items.slice(2).map((i) => i.artworkId)).toEqual([
      ids.stuck,
      ids.sending,
      ids.queued,
      ids.quiet,
    ]);

    expect(byId.get(ids.quiet as string)).toMatchObject({
      status: "not_announced",
      toldSubscribers: false,
      matched: 0,
    });
    expect(byId.get(ids.queued as string)).toMatchObject({ status: "queued", matched: 0 });
    expect(byId.get(ids.sending as string)).toMatchObject({
      status: "sending",
      toldSubscribers: true,
      matched: 3,
      emailed: 1,
      waiting: 1,
      notSent: 1,
      notSentReasons: [{ reason: "topic_off", count: 1 }],
      publishedByName: "Sam Example",
    });
    expect(byId.get(ids.stuck as string)).toMatchObject({
      status: "not_sent_yet",
      matched: 2,
      emailed: 1,
      waiting: 1,
      publishedByName: null,
    });
    expect(byId.get(ids.sent as string)).toMatchObject({
      status: "sent",
      matched: 5,
      emailed: 2,
      waiting: 0,
      notSent: 3,
      notSentReasons: [
        { reason: "topic_off", count: 2 },
        { reason: "withdrawn", count: 1 },
      ],
    });
    expect(byId.get(ids.tie as string)).toMatchObject({ status: "sent", matched: 0 });
  });

  it("never carries a subscriber's address", async () => {
    const page = await store().list({});
    expect(JSON.stringify(page)).not.toContain("@example.com");
  });

  it("pages by cursor without skipping or repeating a release, ties included", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let round = 0; round < 10; round += 1) {
      const page = await store().list({ cursor, limit: 2 });
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((i) => i.artworkId));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    const all = (await store().list({})).items.map((i) => i.artworkId);
    expect(seen).toEqual(all);
    expect(new Set(seen).size).toBe(6);
  });

  it("costs the same number of queries whatever the page size", async () => {
    const spy = vi.spyOn(shopPool, "query");
    await store().list({ limit: 1 });
    const small = spy.mock.calls.length;
    spy.mockClear();
    await store().list({ limit: 50 });
    const large = spy.mock.calls.length;
    spy.mockRestore();
    // The page, then counts, drop reasons and publishers for the whole page: never one per row.
    expect(small).toBe(4);
    expect(large).toBe(4);
  });
});
