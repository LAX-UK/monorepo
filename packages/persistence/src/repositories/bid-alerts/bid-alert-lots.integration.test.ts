import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BidAlertFollowerProvisioner,
  BidAlertLotReader,
  BidAlertLotStart,
  BidAlertMatchLedger,
  BidAlertSubscriberStore,
  BidAlertTopicStore,
  BidAlertWatcherReader,
} from "./index.js";

const url = process.env.DATABASE_URL;
const HAS_DB = Boolean(url);
// biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
const db = HAS_DB ? createDb(url!) : (null as never);

const NOW = new Date("2026-11-03T09:00:00.000Z");

async function insertUser(verified = true): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `${id}@example.com`;
  await db.execute(
    sql`insert into "user" (id, email, name, created_at, updated_at) values (${id}, ${email}, 'Probe', now(), now())`,
  );
  await db.execute(sql`
    insert into bid_identity_directory (subject_id, email, name, email_verified, identity_created_at)
    values (${id}, ${email}, 'Probe', ${verified}, now())`);
  return { id, email };
}

async function insertArtist(name = "Iris Calder"): Promise<string> {
  const id = randomUUID();
  await db.execute(
    sql`insert into artist_profile (id, display_name, slug) values (${id}, ${name}, ${`a-${id}`})`,
  );
  return id;
}

async function follow(
  userId: string,
  artistId: string,
  criteria: { medium?: string; min?: string; max?: string } = {},
) {
  await db.execute(sql`
    insert into artist_watchlist (user_id, artist_id, alert_medium, alert_price_min, alert_price_max)
    values (${userId}, ${artistId}, ${criteria.medium ?? null}, ${criteria.min ?? null}, ${criteria.max ?? null})`);
}

async function saveSearch(userId: string, query: Record<string, string>, notifyEmail = true) {
  const id = randomUUID();
  await db.execute(sql`
    insert into saved_search (id, user_id, label, query, notify_email)
    values (${id}, ${userId}, 'Search', ${JSON.stringify(query)}::jsonb, ${notifyEmail})`);
  return id;
}

let entityId: string | null = null;

async function insertLot(input: {
  saleStatus?: string;
  lotStatus?: string;
  artistId?: string | null;
  title?: string;
  medium?: string | null;
  startingPrice?: string;
  estimate?: { low: string; high: string };
  /** Staff's choice recorded when the sale was published; null records none. */
  announce?: boolean | null;
}): Promise<string> {
  if (!entityId) {
    const owner = await insertUser();
    entityId = randomUUID();
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: "Alert lots test house",
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: owner.id,
      status: "approved",
    });
  }
  const saleId = randomUUID();
  await db.execute(sql`
    insert into sale (id, title, status, start_time, end_time, delivery_mode, created_by_legal_entity_id)
    values (${saleId}, 'Modern British', ${input.saleStatus ?? "scheduled"}::sale_status,
      '2026-11-18T10:00:00Z', '2026-11-26T18:00:00Z', 'online', ${entityId})`);
  if (input.announce !== null) {
    await db.execute(sql`
      insert into bid_alert_announcement (item_key, announce)
      values (${`sale:${saleId}`}, ${input.announce ?? true})`);
  }
  const id = randomUUID();
  const details = input.estimate ? { estimate: { ...input.estimate, currency: "GBP" } } : {};
  await db.execute(sql`
    insert into lot (id, sale_id, seller_legal_entity_id, artist_id, title, medium, auction_type,
      starting_price, current_price, start_time, end_time, status, marketing_details)
    values (${id}, ${saleId}, ${entityId}, ${input.artistId ?? null}, ${input.title ?? "Low tide"},
      ${input.medium ?? null}, 'english', ${input.startingPrice ?? "1000.00"},
      ${input.startingPrice ?? "1000.00"}, '2026-11-18T10:00:00Z', '2026-11-26T18:00:00Z',
      ${input.lotStatus ?? "scheduled"}::lot_status, ${JSON.stringify(details)}::jsonb)`);
  return id;
}

describe.skipIf(!HAS_DB)("Bid lot alert adapters (integration)", () => {
  const subscribers = HAS_DB ? new BidAlertSubscriberStore(db) : (null as never);
  const topics = HAS_DB ? new BidAlertTopicStore(db) : (null as never);
  const provisioner = new BidAlertFollowerProvisioner(db);
  const watchers = new BidAlertWatcherReader(db);
  const lots = new BidAlertLotReader(db);

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE bid_alert_match, bid_alert_digest, bid_alert_topic, bid_alert_subscriber, bid_alert_announcement CASCADE`,
    );
  });

  describe("provisioning", () => {
    it("switches the artist topic on for a verified follower who never chose", async () => {
      const person = await insertUser();
      const artist = await insertArtist();
      await follow(person.id, artist);

      await provisioner.ensureArtistFollowers([artist], NOW);
      await provisioner.ensureArtistFollowers([artist], NOW);

      const record = await subscribers.findBySubject("bid", person.id);
      expect(record?.status).toBe("confirmed");
      expect(await topics.list(record?.id ?? "")).toEqual([
        { topic: "bid.artists", emailOn: true },
      ]);
    });

    it("leaves an unverified account, a stopped subscriber and a switched-off topic alone", async () => {
      const artist = await insertArtist();
      const unverified = await insertUser(false);
      await follow(unverified.id, artist);

      const stopped = await insertUser();
      await follow(stopped.id, artist);
      const stoppedRow = await subscribers.saveConfirmedForAccount({
        product: "bid",
        email: stopped.email,
        subjectId: stopped.id,
        consentText: "x",
        consentSource: "y",
        now: NOW,
      });
      await subscribers.stop(stoppedRow.id, "link", NOW);

      const off = await insertUser();
      await follow(off.id, artist);
      const offRow = await subscribers.saveConfirmedForAccount({
        product: "bid",
        email: off.email,
        subjectId: off.id,
        consentText: "x",
        consentSource: "y",
        now: NOW,
      });
      await topics.setEmail(offRow.id, "bid.artists", false, "person", NOW);

      await provisioner.ensureArtistFollowers([artist], NOW);

      expect(await subscribers.findBySubject("bid", unverified.id)).toBeNull();
      expect((await subscribers.findBySubject("bid", stopped.id))?.status).toBe("stopped");
      expect(await topics.list(stoppedRow.id)).toEqual([]);
      expect(await topics.list(offRow.id)).toEqual([{ topic: "bid.artists", emailOn: false }]);
    });

    it("takes over a confirmed visitor sign-up for the account's own address", async () => {
      const person = await insertUser();
      const artist = await insertArtist();
      await follow(person.id, artist);
      const visitor = await subscribers.savePending({
        product: "bid",
        email: person.email,
        consentText: "x",
        consentSource: "web_home_alerts",
        now: NOW,
      });
      await subscribers.confirm(visitor.id, NOW);

      await provisioner.ensureArtistFollowers([artist], NOW);

      const record = await subscribers.findBySubject("bid", person.id);
      expect(record?.id).toBe(visitor.id);
      expect(await topics.list(visitor.id)).toEqual([{ topic: "bid.artists", emailOn: true }]);
    });

    it("switches the search topic on only for people with a search with email on", async () => {
      const withSearch = await insertUser();
      const emailOff = await insertUser();
      await saveSearch(withSearch.id, { q: "tide" });
      await saveSearch(emailOff.id, { q: "tide" }, false);

      await provisioner.ensureSearchers(NOW);

      expect(await subscribers.findBySubject("bid", withSearch.id)).not.toBeNull();
      expect(await subscribers.findBySubject("bid", emailOff.id)).toBeNull();
    });
  });

  describe("watchers", () => {
    it("returns followers with their criteria, only for confirmed subscribers with the topic on", async () => {
      const artist = await insertArtist();
      const other = await insertArtist("Patrick Heron");
      const a = await insertUser();
      const b = await insertUser();
      await follow(a.id, artist, { medium: "oil", min: "2000", max: "20000" });
      await follow(b.id, other);
      await provisioner.ensureArtistFollowers([artist, other], NOW);

      const found = await watchers.artistWatchers([artist]);
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        artistId: artist,
        criteria: { medium: "oil", priceMin: "2000.00", priceMax: "20000.00" },
      });
    });

    it("returns saved searches with email on, with text and category read from the query", async () => {
      const person = await insertUser();
      const category = randomUUID();
      const id = await saveSearch(person.id, { q: "tide", categoryId: category });
      await saveSearch(person.id, { q: "off" }, false);
      await provisioner.ensureSearchers(NOW);

      const found = await watchers.alertingSearches();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        searchId: id,
        query: { q: "tide", categoryId: category },
      });
    });
  });

  describe("lots", () => {
    it("finds lots that are on sale in a public sale, with artist, sale and estimate", async () => {
      const artist = await insertArtist();
      const live = await insertLot({
        artistId: artist,
        medium: "Oil on canvas",
        startingPrice: "3000.00",
        estimate: { low: "5000.00", high: "8000.00" },
      });
      const plain = await insertLot({ startingPrice: "250.00" });
      const draftSale = await insertLot({ saleStatus: "draft" });
      const draftLot = await insertLot({ lotStatus: "draft" });

      const found = await lots.findAlertable([live, plain, draftSale, draftLot]);
      expect(found.map((l) => l.id).sort()).toEqual([live, plain].sort());
      const one = found.find((l) => l.id === live);
      expect(one).toMatchObject({
        artistName: "Iris Calder",
        saleTitle: "Modern British",
        price: "5000.00",
        estimate: { low: "5000.00", high: "8000.00", currency: "GBP" },
      });
      expect(found.find((l) => l.id === plain)).toMatchObject({ price: "250.00", estimate: null });
    });

    it("reports whether the sale was announced, and treats a sale with no recorded choice as not", async () => {
      const announced = await insertLot({});
      const quiet = await insertLot({ announce: false });
      const unrecorded = await insertLot({ announce: null });
      const found = await lots.findAlertable([announced, quiet, unrecorded]);
      const flag = (id: string) => found.find((l) => l.id === id)?.saleAnnounced;
      expect(flag(announced)).toBe(true);
      expect(flag(quiet)).toBe(false);
      expect(flag(unrecorded)).toBe(false);
    });

    it("applies the search page's text filter to the batch, and never matches an empty search", async () => {
      const tide = await insertLot({ title: "Low tide at Dungeness" });
      const other = await insertLot({ title: "Harbour wall" });
      expect([
        ...(await lots.matchingSearch({ q: "tide", categoryId: null }, [tide, other])),
      ]).toEqual([tide]);
      expect([
        ...(await lots.matchingSearch({ q: "ti", categoryId: null }, [tide, other])),
      ]).toEqual([]);
      expect((await lots.matchingSearch({ q: " ", categoryId: null }, [tide, other])).size).toBe(0);
    });
  });

  describe("ledger and start point", () => {
    it("records a lot once per person across topics, batches and runs", async () => {
      const person = await insertUser();
      const row = await subscribers.saveConfirmedForAccount({
        product: "bid",
        email: person.email,
        subjectId: person.id,
        consentText: "x",
        consentSource: "y",
        now: NOW,
      });
      const ledger = new BidAlertMatchLedger(db);
      const match = (topic: "bid.artists" | "bid.searches", lotId: string) => ({
        subscriberId: row.id,
        topic,
        itemKey: `lot:${lotId}`,
        groupKey: null,
        snapshot: { title: "Low tide", path: "/lot/low-tide/x" },
        matchedAt: NOW,
      });
      expect(await ledger.record([match("bid.artists", "l1")])).toBe(1);
      expect(await ledger.record([match("bid.searches", "l1")])).toBe(0);
      expect(await ledger.record([match("bid.searches", "l1"), match("bid.searches", "l2")])).toBe(
        1,
      );
      expect((await ledger.pendingFor(row.id)).map((m) => [m.topic, m.itemKey]).sort()).toEqual([
        ["bid.artists", "lot:l1"],
        ["bid.searches", "lot:l2"],
      ]);
    });

    it("sets the lot start once at the newest event and never moves it", async () => {
      await db.execute(
        sql`delete from projector_state where projector_name = 'bid_alert_lot_matching_start'`,
      );
      const start = new BidAlertLotStart(db);
      const first = await start.position();
      await insertLot({});
      expect(await start.position()).toBe(first);
    });
  });
});
