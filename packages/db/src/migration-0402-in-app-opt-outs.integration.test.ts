import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) => readFileSync(join(drizzleDir, name), "utf8");
const TAG = "0402_notice_delivery_preferences";
const ROLLBACK = "0402_rollback.sql";
const migration = read(`${TAG}.sql`)
  .replaceAll("--> statement-breakpoint", "")
  .replace("SET LOCAL lock_timeout = '30s';", "");
/** The rollback's statements without its own BEGIN/COMMIT, so the test's transaction holds them. */
const rollbackBody = read(ROLLBACK).replace(/^BEGIN;$|^COMMIT;$/gm, "");

type Topic = "bid.artists" | "bid.searches";
type Person = {
  id: string;
  /** null: the person has no notification_preference row. */
  prefs: { artists: boolean; searches: boolean } | null;
  subscribers: {
    status: "pending" | "confirmed" | "stopped";
    topics: Partial<Record<Topic, boolean>>;
  }[];
};

/**
 * Who gets an artist or saved-search notice after the upgrade, exactly as the release reads it:
 * `BidAlertWatcherReader` keeps a confirmed subscriber whose topic email is on or whose app switch
 * is on (no preference row counts as on), and `BidAlertInAppTopics` / the notice writer then need
 * the app switch on. A person whose email is off therefore gets a notice only with the switch on.
 */
const NOTICE_RECIPIENTS = (topic: Topic, column: string) => `
  SELECT DISTINCT s.user_id
  FROM bid_alert_subscriber s
  JOIN bid_alert_topic t ON t.subscriber_id = s.id AND t.topic = '${topic}'
  LEFT JOIN notification_preference p ON p.user_id = s.user_id
  WHERE s.status = 'confirmed'
    AND (t.email_on OR COALESCE(p.${column}, true))
    AND COALESCE(p.${column}, true)
    AND s.user_id = ANY($1::text[])`;

/**
 * Runs inside one transaction that is always rolled back: steps the migration back, seeds people
 * as the previous release left them, applies the migration and checks the carried-over opt-outs.
 */
describe.skipIf(!url)(
  "migration 0402 carries email opt-outs over to the app",
  { timeout: 60_000 },
  () => {
    let client: pg.Client;
    const run = `m0402-${Date.now()}`;
    const id = (name: string) => `${run}-${name}`;

    const people: Person[] = [
      // Turned the artist email off; the stored switch is the default, never shown while it was off.
      {
        id: id("artists-off"),
        prefs: { artists: true, searches: true },
        subscribers: [
          { status: "confirmed", topics: { "bid.artists": false, "bid.searches": true } },
        ],
      },
      // Turned the saved-search email off and never opened notification settings: no preference row.
      {
        id: id("searches-off-no-row"),
        prefs: null,
        subscribers: [
          { status: "confirmed", topics: { "bid.artists": true, "bid.searches": false } },
        ],
      },
      // Stopped every Bid alert from an email link.
      {
        id: id("stopped"),
        prefs: null,
        subscribers: [{ status: "stopped", topics: { "bid.artists": true, "bid.searches": true } }],
      },
      // Both emails on: nothing changes, and no row is created.
      {
        id: id("both-on"),
        prefs: null,
        subscribers: [
          { status: "confirmed", topics: { "bid.artists": true, "bid.searches": true } },
        ],
      },
      // Both emails on, and the person turned the artist app notice off themselves: kept.
      {
        id: id("chose-app-off"),
        prefs: { artists: false, searches: true },
        subscribers: [
          { status: "confirmed", topics: { "bid.artists": true, "bid.searches": true } },
        ],
      },
      // An old stopped address and a confirmed new one with both emails on: the new one delivered.
      {
        id: id("moved-address"),
        prefs: null,
        subscribers: [
          { status: "stopped", topics: {} },
          { status: "confirmed", topics: { "bid.artists": true, "bid.searches": true } },
        ],
      },
    ];
    const ids = people.map((p) => p.id);

    async function seed(person: Person) {
      await client.query(
        `insert into "user" (id, name, email, created_at, updated_at) values ($1, $1, $1 || '@example.test', now(), now())`,
        [person.id],
      );
      if (person.prefs) {
        await client.query(
          `insert into notification_preference (user_id, artist_alerts_in_app, search_alerts_in_app)
         values ($1, $2, $3)`,
          [person.id, person.prefs.artists, person.prefs.searches],
        );
      }
      for (const [n, subscriber] of person.subscribers.entries()) {
        const { rows } = await client.query<{ id: string }>(
          `insert into bid_alert_subscriber
           (product, email, user_id, status, consent_text, consent_source, requested_at, confirmed_at,
            stopped_at, stop_reason)
         values ('bid', $1, $2, $3, 'x', 'y', now(), now(),
                 case when $3 = 'stopped' then now() end, case when $3 = 'stopped' then 'link' end)
         returning id`,
          [`${person.id}-${n}@example.test`, person.id, subscriber.status],
        );
        for (const [topic, on] of Object.entries(subscriber.topics)) {
          await client.query(
            "insert into bid_alert_topic (subscriber_id, topic, email_on) values ($1, $2, $3)",
            [rows[0]?.id, topic, on],
          );
        }
      }
    }

    async function switches() {
      const { rows } = await client.query<{ user_id: string; artists: boolean; searches: boolean }>(
        `select user_id, artist_alerts_in_app as artists, search_alerts_in_app as searches
       from notification_preference where user_id = any($1::text[])`,
        [ids],
      );
      return Object.fromEntries(
        rows.map((r) => [
          r.user_id.slice(run.length + 1),
          { artists: r.artists, searches: r.searches },
        ]),
      );
    }

    async function recipients(topic: Topic, column: string) {
      const { rows } = await client.query<{ user_id: string }>(NOTICE_RECIPIENTS(topic, column), [
        ids,
      ]);
      return rows.map((r) => r.user_id.slice(run.length + 1)).sort();
    }

    beforeAll(async () => {
      client = new pg.Client(buildPgConnectionConfig(url as string));
      await client.connect();
    });

    afterAll(async () => {
      await client.query("rollback");
      await client.end();
    });

    beforeEach(async () => {
      await client.query("rollback");
      await client.query("begin");
      // Start from before this migration, as the database of the previous release would be.
      await client.query(rollbackBody);
      for (const person of people) await seed(person);
      await client.query(migration);
    });

    it("turns the app switch off where the email was off or Bid alerts were stopped, and nowhere else", async () => {
      expect(await switches()).toEqual({
        "artists-off": { artists: false, searches: true },
        "searches-off-no-row": { artists: true, searches: false },
        stopped: { artists: false, searches: false },
        "chose-app-off": { artists: false, searches: true },
      });
    });

    it("gives nobody a notice they had turned off: only people whose email was on get one", async () => {
      expect(await recipients("bid.artists", "artist_alerts_in_app")).toEqual([
        "both-on",
        "moved-address",
        "searches-off-no-row",
      ]);
      expect(await recipients("bid.searches", "search_alerts_in_app")).toEqual([
        "artists-off",
        "both-on",
        "chose-app-off",
        "moved-address",
      ]);
    });

    it("is safe to run twice", async () => {
      const before = await switches();
      await client.query(migration);
      expect(await switches()).toEqual(before);
    });

    it("rolls back to what the previous release stored, keeping a switch the person chose", async () => {
      await client.query(rollbackBody);
      expect(await switches()).toEqual({
        "artists-off": { artists: true, searches: true },
        "searches-off-no-row": { artists: true, searches: true },
        stopped: { artists: true, searches: true },
        "chose-app-off": { artists: false, searches: true },
      });
    });
  },
);
