import type { Database } from "@auction/db";
import {
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
import {
  ShopAlertAnnouncementStore,
  ShopAlertDigestLedger,
  ShopAlertMatchLedger,
} from "./shop-alert-ledgers.js";

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

/** An unsent digest made at `madeAt`, as the digest run claims one before it sends. */
async function digest(db: Database, subscriberId: string, madeAt: Date) {
  const [row] = await db
    .insert(shopAlertDigest)
    .values({
      subscriberId,
      product: "shop",
      localDate: madeAt.toISOString().slice(0, 10),
      itemCount: 1,
      outboxIdempotencyKey: `send-log-${subscriberId}`,
      createdAt: madeAt,
    })
    .returning({ id: shopAlertDigest.id });
  if (!row) throw new Error("digest fixture missing");
  return row.id;
}

/**
 * A back-in-stock match on the same work: not part of the release alert, so never counted. It is
 * only inserted here; `settleOtherTopic` settles it, so a fixture can record it before the release
 * expands and settle it after, as the engine would.
 */
type OtherTopic = "emailed" | "dropped" | { unsentFor: number };

async function otherTopicMatch(db: Database, artworkId: string, settle: OtherTopic) {
  const subscriberId = await subscriber(db);
  const digestId =
    settle === "emailed"
      ? await digest(db, subscriberId, ago(2 * HOUR))
      : typeof settle === "object"
        ? await digest(db, subscriberId, ago(settle.unsentFor))
        : null;
  const [row] = await db
    .insert(shopAlertMatch)
    .values({
      subscriberId,
      topic: "shop.back_in_stock",
      itemKey: artworkItemKey(artworkId),
      snapshot: { title: "fixture", path: "/artworks/fixture" },
      digestId,
    })
    .returning({ id: shopAlertMatch.id });
  if (!row) throw new Error("other-topic match fixture missing");
  return { matchId: row.id, digestId, settle };
}

async function settleOtherTopic(
  db: Database,
  match: Awaited<ReturnType<typeof otherTopicMatch>>,
  droppedReason = "withdrawn",
) {
  if (match.settle === "emailed" && match.digestId) {
    await new ShopAlertDigestLedger(db).markSent(match.digestId, ago(HOUR));
  }
  if (match.settle === "dropped") {
    await new ShopAlertMatchLedger(db).drop([match.matchId], droppedReason, NOW);
  }
}

/**
 * How one person's match ends up: emailed (its digest marked sent), waiting for a digest, in an
 * unsent digest made `unsentFor` ago, or dropped with an engine reason.
 */
type MatchKind = "emailed" | "waiting" | { unsentFor: number } | { dropped: string };

type Fixture = { subscriberId: string; matchId: string; digestId: string | null; kind: MatchKind };

/** Matches are recorded, then the release expands, then each settles through the real ledgers. */
async function release(
  db: Database,
  artworkId: string,
  at: Date,
  kinds: readonly MatchKind[],
  opts: {
    announce?: boolean;
    expanded?: boolean;
    kind?: string | null;
    by?: string;
    topic?: string;
    /** Runs after the release's own matches are recorded and before it expands. */
    beforeExpand?: () => Promise<void>;
  } = {},
): Promise<Fixture[]> {
  const itemKey = artworkItemKey(artworkId);
  await db.insert(shopAlertAnnouncement).values({
    itemKey,
    announcedAt: at,
    announce: opts.announce ?? true,
    kind: opts.kind === undefined ? "shop_release" : opts.kind,
    announcedBy: opts.by ?? null,
  });
  const made: Fixture[] = [];
  for (const kind of kinds) {
    const subscriberId = await subscriber(db);
    const digestId =
      kind === "emailed"
        ? await digest(db, subscriberId, ago(2 * HOUR))
        : typeof kind === "object" && "unsentFor" in kind
          ? await digest(db, subscriberId, ago(kind.unsentFor))
          : null;
    const [row] = await db
      .insert(shopAlertMatch)
      .values({
        subscriberId,
        topic: opts.topic ?? "shop.releases",
        itemKey,
        snapshot: { title: "fixture", path: "/artworks/fixture" },
        matchedAt: at,
        digestId,
      })
      .returning({ id: shopAlertMatch.id });
    if (!row) throw new Error("match fixture missing");
    made.push({ subscriberId, matchId: row.id, digestId, kind });
  }
  await opts.beforeExpand?.();
  if (opts.expanded !== false) await new ShopAlertAnnouncementStore(db).markExpanded(itemKey, at);
  for (const fixture of made) {
    if (fixture.kind === "emailed" && fixture.digestId) {
      await new ShopAlertDigestLedger(db).markSent(fixture.digestId, ago(HOUR));
    }
    if (typeof fixture.kind === "object" && "dropped" in fixture.kind) {
      await new ShopAlertMatchLedger(db).drop([fixture.matchId], fixture.kind.dropped, NOW);
    }
  }
  return made;
}

describe.skipIf(!hasShopIntegrationDb)("ReleaseAlertSendLogStore (integration)", () => {
  let db: Database;
  let shopPool: pg.Pool;
  const ids: Record<string, string> = {};
  const fixtures: Record<string, Fixture[]> = {};
  let publisher = "";

  const clearAlerts = async () =>
    (await ensurePools()).ownerPool.query(
      "TRUNCATE shop_alert_match, shop_alert_digest, shop_alert_topic, shop_alert_subscriber, shop_alert_announcement CASCADE",
    );

  const artwork = async (label: string) => {
    ids[label] = (await importTestArtwork(db, `send-log-${label}`)).artworkId;
    return ids[label] as string;
  };

  // Left behind, the queued release would be picked up by another suite's matching run.
  afterEach(clearAlerts);

  beforeEach(async () => {
    shopPool = (await ensurePools()).shopPool;
    await clearAlerts();
    db = createShopDb(shopPool);
    publisher = `send-log-publisher-${Date.now()}`;
    await db
      .insert(shopUserProfile)
      .values({ identitySubjectId: publisher, email: `${publisher}@example.com`, name: " Sam " });

    // Newest first: sent, tie, tie2 (all three at one instant), stuck, sending, queued, quiet.
    fixtures.quiet = await release(db, await artwork("quiet"), ago(60 * HOUR), [], {
      announce: false,
    });
    fixtures.queued = await release(db, await artwork("queued"), ago(50 * HOUR), [], {
      expanded: false,
    });
    // Another topic's matches for the same work, one emailed and one dropped, are not part of
    // the release alert. They exist before the release expands, so the matched count taken then
    // has to leave them out, and they settle through the same ledgers as the release's own.
    const sendingId = await artwork("sending");
    const sendingOthers: Awaited<ReturnType<typeof otherTopicMatch>>[] = [];
    fixtures.sending = await release(
      db,
      sendingId,
      ago(40 * HOUR),
      ["emailed", "waiting", { dropped: "topic_off" }],
      {
        by: publisher,
        beforeExpand: async () => {
          for (const settle of ["emailed", "dropped"] as const) {
            sendingOthers.push(await otherTopicMatch(db, sendingId, settle));
          }
        },
      },
    );
    for (const other of sendingOthers) await settleOtherTopic(db, other);
    fixtures.stuck = await release(db, await artwork("stuck"), ago(35 * HOUR), [
      { unsentFor: 30 * HOUR },
      "emailed",
    ]);
    fixtures.sent = await release(db, await artwork("sent"), ago(20 * HOUR), [
      "emailed",
      "emailed",
      { dropped: "withdrawn" },
      { dropped: "topic_off" },
      { dropped: "topic_off" },
    ]);
    // A back-in-stock match on the finished release, still in a digest unsent for over a day:
    // it is neither waiting for the release alert nor a reason to call the release stuck.
    await otherTopicMatch(db, ids.sent as string, { unsentFor: 30 * HOUR });
    fixtures.tie = await release(db, await artwork("tie"), ago(20 * HOUR), []);
    fixtures.tie2 = await release(db, await artwork("tie2"), ago(20 * HOUR), []);
  });

  const store = () =>
    new ReleaseAlertSendLogStore(
      db,
      (v) => v ?? null,
      () => NOW,
    );

  const row = async (label: string) =>
    (await store().list({ limit: 50 })).items.find((item) => item.artworkId === ids[label]);

  it("lists shop releases newest first with kept counts and a status each", async () => {
    const { items, nextCursor } = await store().list({});
    expect(nextCursor).toBeNull();
    const byId = new Map(items.map((item) => [item.artworkId, item]));
    expect(items).toHaveLength(7);
    expect(items.slice(3).map((i) => i.artworkId)).toEqual([
      ids.stuck,
      ids.sending,
      ids.queued,
      ids.quiet,
    ]);

    expect(byId.get(ids.quiet as string)).toMatchObject({
      status: "not_announced",
      toldSubscribers: false,
      matched: 0,
      countsKept: true,
    });
    expect(byId.get(ids.queued as string)).toMatchObject({ status: "queued", matched: 0 });
    expect(byId.get(ids.sending as string)).toMatchObject({
      status: "sending",
      toldSubscribers: true,
      countsKept: true,
      matched: 3,
      emailed: 1,
      waiting: 1,
      notSent: 1,
      notSentReasons: [{ reason: "topic_off", count: 1 }],
      publishedByName: "Sam",
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
      countsKept: true,
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

  it("pages through releases tied on the same instant across a page boundary", async () => {
    const all = (await store().list({})).items.map((i) => i.artworkId);
    // The three tied releases are rows 1 to 3: with one or two a page, a boundary falls between
    // two of them, so the cursor has to break the tie on the item to neither skip nor repeat.
    expect(new Set(all.slice(0, 3))).toEqual(new Set([ids.sent, ids.tie, ids.tie2]));
    for (const limit of [1, 2]) {
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let round = 0; round < 20; round += 1) {
        const page = await store().list({ cursor, limit });
        expect(page.items.length).toBeLessThanOrEqual(limit);
        seen.push(...page.items.map((i) => i.artworkId));
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      expect(seen, `limit ${limit}`).toEqual(all);
    }
  });

  describe("the 24-hour stuck threshold", () => {
    beforeEach(async () => {
      await release(db, await artwork("fresh"), ago(30 * HOUR), [{ unsentFor: 23 * HOUR }]);
      await release(db, await artwork("overdue"), ago(30 * HOUR), [{ unsentFor: 25 * HOUR }]);
    });

    it("reads a digest unsent for under a day as still sending", async () => {
      expect(await row("fresh")).toMatchObject({ status: "sending", waiting: 1, emailed: 0 });
    });

    it("reads a digest unsent for over a day as not sent yet", async () => {
      expect(await row("overdue")).toMatchObject({
        status: "not_sent_yet",
        waiting: 1,
        emailed: 0,
      });
    });
  });

  describe("counts kept on the release", () => {
    it("hold after the matches are pruned and their subscribers deleted", async () => {
      const before = await row("sent");
      // The 90-day prune removes settled matches; pruning or erasing a subscriber cascades too.
      await db
        .delete(shopAlertMatch)
        .where(eq(shopAlertMatch.itemKey, artworkItemKey(ids.sent as string)));
      for (const fixture of fixtures.sent ?? []) {
        await db
          .delete(shopAlertSubscriber)
          .where(eq(shopAlertSubscriber.id, fixture.subscriberId));
      }
      expect(await row("sent")).toEqual(before);
      expect(before).toMatchObject({ status: "sent", matched: 5, emailed: 2, notSent: 3 });
    });

    it("count a subscriber removed before sending as not sent, with the reason", async () => {
      const waiting = (fixtures.sending ?? []).find((f) => f.kind === "waiting");
      await db
        .delete(shopAlertSubscriber)
        .where(eq(shopAlertSubscriber.id, waiting?.subscriberId ?? ""));
      expect(await row("sending")).toMatchObject({
        status: "sent",
        countsKept: true,
        matched: 3,
        emailed: 1,
        waiting: 0,
        notSent: 2,
        notSentReasons: [
          { reason: "removed_before_sending", count: 1 },
          { reason: "topic_off", count: 1 },
        ],
      });
    });

    it("count each match once when a digest is marked sent or a match dropped again", async () => {
      const emailed = (fixtures.sent ?? []).find((f) => f.kind === "emailed");
      const dropped = (fixtures.sent ?? []).find(
        (f) => typeof f.kind === "object" && "dropped" in f.kind,
      );
      await new ShopAlertDigestLedger(db).markSent(emailed?.digestId ?? "", NOW);
      await new ShopAlertMatchLedger(db).drop([dropped?.matchId ?? ""], "withdrawn", NOW);
      expect(await row("sent")).toMatchObject({ matched: 5, emailed: 2, notSent: 3 });
    });

    it("leave other topics' matches out of the kept counts", async () => {
      const [kept] = await db
        .select({
          matched: shopAlertAnnouncement.matchedCount,
          emailed: shopAlertAnnouncement.emailedCount,
          dropped: shopAlertAnnouncement.droppedCount,
          reasons: shopAlertAnnouncement.droppedReasons,
        })
        .from(shopAlertAnnouncement)
        .where(eq(shopAlertAnnouncement.itemKey, artworkItemKey(ids.sending as string)));
      expect(kept).toEqual({ matched: 3, emailed: 1, dropped: 1, reasons: { topic_off: 1 } });
    });

    it("never report fewer matched than were emailed, dropped or still waiting", async () => {
      // A kept matched count below what has since settled (a match recorded after expansion)
      // is raised to the settled total, never read as a negative "removed before sending".
      await db
        .update(shopAlertAnnouncement)
        .set({ matchedCount: 1 })
        .where(eq(shopAlertAnnouncement.itemKey, artworkItemKey(ids.sent as string)));
      expect(await row("sent")).toMatchObject({
        status: "sent",
        matched: 5,
        emailed: 2,
        notSent: 3,
        notSentReasons: [
          { reason: "topic_off", count: 2 },
          { reason: "withdrawn", count: 1 },
        ],
      });
    });

    it("leave a waiting other-topic match out of a finished release", async () => {
      expect(await row("sent")).toMatchObject({
        status: "sent",
        waiting: 0,
        matched: 5,
        notSent: 3,
      });
    });

    it("are not claimed for a release from before they were kept", async () => {
      const legacy = await artwork("legacy");
      await release(db, legacy, ago(80 * HOUR), ["emailed", { dropped: "withdrawn" }]);
      // A dropped back-in-stock match: its reason is not one of the release's.
      await settleOtherTopic(db, await otherTopicMatch(db, legacy, "dropped"), "not_subscribed");
      await db
        .update(shopAlertAnnouncement)
        .set({ matchedCount: null, emailedCount: null, droppedCount: null, droppedReasons: null })
        .where(eq(shopAlertAnnouncement.itemKey, artworkItemKey(legacy)));
      const legacyWaiting = await artwork("legacy-waiting");
      await release(db, legacyWaiting, ago(70 * HOUR), ["waiting"]);
      await db
        .update(shopAlertAnnouncement)
        .set({ matchedCount: null, emailedCount: null, droppedCount: null, droppedReasons: null })
        .where(eq(shopAlertAnnouncement.itemKey, artworkItemKey(legacyWaiting)));

      expect(await row("legacy")).toMatchObject({
        status: "counts_not_kept",
        countsKept: false,
        matched: 2,
        emailed: 1,
        notSent: 1,
        notSentReasons: [{ reason: "withdrawn", count: 1 }],
      });
      // Pruned, it matched nobody as far as the rows go: still not a confident "Sent".
      await db.delete(shopAlertMatch).where(eq(shopAlertMatch.itemKey, artworkItemKey(legacy)));
      expect(await row("legacy")).toMatchObject({ status: "counts_not_kept", matched: 0 });
      // Still going out, it reads as sending like any other.
      expect(await row("legacy-waiting")).toMatchObject({
        status: "sending",
        countsKept: false,
        waiting: 1,
      });
    });
  });

  describe("which releases are listed", () => {
    it("keeps a release listed after the work's edition flags change", async () => {
      await db
        .update(shopArtwork)
        .set({ eligibleForEditionAllocation: false, salesChannel: "art" })
        .where(eq(shopArtwork.id, ids.sent as string));
      expect(await row("sent")).toMatchObject({ status: "sent", matched: 5 });
    });

    it("leaves out works announced as lax.art originals, whatever their flags say now", async () => {
      const original = await artwork("original");
      await release(db, original, ago(HOUR), [], { kind: "art_original" });
      const listed = (await store().list({ limit: 50 })).items.map((i) => i.artworkId);
      expect(listed).not.toContain(original);
      expect(listed).toHaveLength(7);
    });

    it("reads a release with no kept kind through the work's current flags", async () => {
      // Published by the old build during the deploy overlap, after 0405's backfill ran: no kind
      // and no publisher were kept. An edition shop work is listed, with the publisher unknown.
      const overlap = await artwork("overlap");
      await release(db, overlap, ago(HOUR), ["emailed"], { kind: null });
      // The old build expanded and sent it too: no matched count, counters left at their defaults.
      await db
        .update(shopAlertAnnouncement)
        .set({ matchedCount: null, emailedCount: 0, droppedCount: 0, droppedReasons: {} })
        .where(eq(shopAlertAnnouncement.itemKey, artworkItemKey(overlap)));
      const overlapArt = await artwork("overlap-art");
      await release(db, overlapArt, ago(HOUR), [], { kind: null });
      await db
        .update(shopArtwork)
        .set({ eligibleForEditionAllocation: false, salesChannel: "art" })
        .where(eq(shopArtwork.id, overlapArt));
      const listed = (await store().list({ limit: 50 })).items;
      expect(listed.map((i) => i.artworkId)).not.toContain(overlapArt);
      expect(listed).toHaveLength(8);
      expect(listed.find((i) => i.artworkId === overlap)).toMatchObject({
        status: "counts_not_kept",
        countsKept: false,
        matched: 1,
        emailed: 1,
        publishedByName: null,
      });
    });
  });

  describe("one release by its work (a panel link from another page)", () => {
    it("reads exactly what the release's row in the list says", async () => {
      const listed = (await store().list({ limit: 50 })).items;
      for (const label of ["quiet", "queued", "sending", "stuck", "sent"]) {
        const id = ids[label] as string;
        expect(await store().find(id), label).toEqual(listed.find((i) => i.artworkId === id));
      }
    });

    it("finds a release whatever page it is on", async () => {
      // The oldest release, on the last page at one a page.
      expect(await store().find(ids.quiet as string)).toMatchObject({
        status: "not_announced",
        toldSubscribers: false,
      });
    });

    it("finds nothing for a work with no release, or one announced as a lax.art original", async () => {
      expect(await store().find(await artwork("never-published"))).toBeNull();
      const original = await artwork("original-one");
      await release(db, original, ago(HOUR), [], { kind: "art_original" });
      expect(await store().find(original)).toBeNull();
    });
  });

  it("names the publisher kept on the release, and no one when none is kept", async () => {
    expect((await row("sending"))?.publishedByName).toBe("Sam");
    expect((await row("sent"))?.publishedByName).toBeNull();
    await db
      .update(shopAlertAnnouncement)
      .set({ announcedBy: "subject-without-profile" })
      .where(eq(shopAlertAnnouncement.itemKey, artworkItemKey(ids.sent as string)));
    expect((await row("sent"))?.publishedByName).toBeNull();
  });

  it("costs a fixed number of queries whatever the page size, and never reads the audit log", async () => {
    const spy = vi.spyOn(shopPool, "query");
    const sqlOf = () =>
      spy.mock.calls.map((call) => {
        const first = call[0] as unknown;
        return typeof first === "string" ? first : ((first as { text?: string }).text ?? "");
      });
    await store().list({ limit: 1 });
    const small = spy.mock.calls.length;
    const smallSql = sqlOf();
    spy.mockClear();
    await store().list({ limit: 50 });
    const large = spy.mock.calls.length;
    const largeSql = sqlOf();
    spy.mockRestore();
    // The page with its publisher, then the open matches for the whole page: never one per row.
    expect(small).toBe(2);
    expect(large).toBe(2);
    for (const text of [...smallSql, ...largeSql]) expect(text).not.toContain("shop_admin_audit");
  });

  it("adds one query for drop reasons only when the page holds rows from before 0405", async () => {
    await db
      .update(shopAlertAnnouncement)
      .set({ emailedCount: null, droppedCount: null })
      .where(eq(shopAlertAnnouncement.itemKey, artworkItemKey(ids.sent as string)));
    const spy = vi.spyOn(shopPool, "query");
    await store().list({ limit: 50 });
    const calls = spy.mock.calls.length;
    spy.mockRestore();
    expect(calls).toBe(3);
  });
});
