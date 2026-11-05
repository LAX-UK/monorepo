import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

const consent =
  "One email for each new edition LAX Shop releases. Stop any time with the link in every email.";
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

type Status = "pending" | "confirmed" | "stopped";

/** Runs in one transaction that is always rolled back, on a database already migrated. */
describe.skipIf(!migrationUrl)("migration 0292 shop alert engine", { timeout: 30_000 }, () => {
  let client: pg.Client;

  async function releaseSubscriber(input: {
    email: string;
    status: Status;
    token: string;
    subject?: string | null;
  }): Promise<string> {
    const row = await client.query(
      `insert into shop_release_alert_subscription
         (email, identity_subject_id, status, consent_text, consent_source, confirm_token_hash,
          confirm_requested_at, unsubscribe_token, confirmed_at, stopped_at)
       values ($1, $4, $2, $5, 'shop_home', case when $2 = 'pending' then 'hash' end,
          '2026-10-30T09:00:00Z',  $3,
          case when $2 = 'confirmed' then '2026-10-30T09:05:00Z'::timestamptz end,
          case when $2 = 'stopped' then '2026-10-31T09:00:00Z'::timestamptz end)
       returning id`,
      [input.email, input.status, input.token, input.subject ?? null, consent],
    );
    return row.rows[0].id as string;
  }

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query("rollback");
    await client.query("begin");
    // 0309 drops the old release list on a fully migrated database; bring it back, inside this
    // rolled-back transaction, so 0292 can be exercised against the shape it was written for.
    await client.query(read("0309_rollback.sql"));
  });

  it("moves every release subscriber with its id, state and consent record", async () => {
    const confirmed = await releaseSubscriber({
      email: "confirmed@example.com",
      status: "confirmed",
      token: "token-confirmed",
      subject: "subject-1",
    });
    const pending = await releaseSubscriber({
      email: "pending@example.com",
      status: "pending",
      token: "token-pending",
    });
    const stopped = await releaseSubscriber({
      email: "stopped@example.com",
      status: "stopped",
      token: "token-stopped",
    });
    await client.query(read("0292_shop_alert_engine.sql"));

    const rows = await client.query(
      `select id, product, email, identity_subject_id, status, consent_text, consent_source,
              requested_at, confirmed_at, stopped_at, stop_reason, link_version
       from shop_alert_subscriber where id = any($1) order by email`,
      [[confirmed, pending, stopped]],
    );
    expect(rows.rows.map((r) => [r.id, r.email, r.status, r.product])).toEqual([
      [confirmed, "confirmed@example.com", "confirmed", "shop"],
      [pending, "pending@example.com", "pending", "shop"],
      [stopped, "stopped@example.com", "stopped", "shop"],
    ]);
    const [c, p, s] = rows.rows;
    expect(c.identity_subject_id).toBe("subject-1");
    expect(c.consent_text).toBe(consent);
    expect(c.consent_source).toBe("shop_home");
    expect(c.confirmed_at.toISOString()).toBe("2026-10-30T09:05:00.000Z");
    expect(p.requested_at.toISOString()).toBe("2026-10-30T09:00:00.000Z");
    expect(s.stopped_at.toISOString()).toBe("2026-10-31T09:00:00.000Z");
    expect(s.stop_reason).toBe("link");
    expect(c.stop_reason).toBeNull();
    expect(c.link_version).toBe(1);
  });

  it("keeps only a hash of the stop token, which is the hash the stop route looks up", async () => {
    const id = await releaseSubscriber({
      email: "hash@example.com",
      status: "confirmed",
      token: "plain-stop-token",
    });
    await client.query(read("0292_shop_alert_engine.sql"));
    const row = await client.query(
      "select legacy_link_hash from shop_alert_subscriber where id = $1",
      [id],
    );
    expect(row.rows[0].legacy_link_hash).toBe(sha256("plain-stop-token"));
    const columns = await client.query(
      `select column_name from information_schema.columns where table_name = 'shop_alert_subscriber'`,
    );
    expect(columns.rows.map((r) => r.column_name)).not.toContain("unsubscribe_token");
  });

  it("switches release alerts on for confirmed people only", async () => {
    const confirmed = await releaseSubscriber({
      email: "a@example.com",
      status: "confirmed",
      token: "t-a",
    });
    const pending = await releaseSubscriber({
      email: "b@example.com",
      status: "pending",
      token: "t-b",
    });
    const stopped = await releaseSubscriber({
      email: "c@example.com",
      status: "stopped",
      token: "t-c",
    });
    await client.query(read("0292_shop_alert_engine.sql"));
    const topics = await client.query(
      `select subscriber_id, topic, email_on, changed_by from shop_alert_topic
       where subscriber_id = any($1)`,
      [[confirmed, pending, stopped]],
    );
    const by = new Map(topics.rows.map((r) => [r.subscriber_id, r]));
    expect(by.get(confirmed)).toMatchObject({
      topic: "shop.releases",
      email_on: true,
      changed_by: "migration",
    });
    expect(by.get(pending)?.email_on).toBe(false);
    expect(by.get(stopped)?.email_on).toBe(false);
  });

  it("can run twice without changing anything, and keeps changes made after the first run", async () => {
    const id = await releaseSubscriber({
      email: "again@example.com",
      status: "confirmed",
      token: "t-again",
    });
    await client.query(read("0292_shop_alert_engine.sql"));
    await client.query(
      `update shop_alert_subscriber set status = 'stopped', stop_reason = 'settings' where id = $1`,
      [id],
    );
    await client.query(read("0292_shop_alert_engine.sql"));
    const row = await client.query(
      "select status, stop_reason from shop_alert_subscriber where id = $1",
      [id],
    );
    expect(row.rows[0]).toEqual({ status: "stopped", stop_reason: "settings" });
    const count = await client.query(
      "select count(*)::int as n from shop_alert_topic where subscriber_id = $1",
      [id],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("holds the rules the engine relies on", async () => {
    await client.query(read("0292_shop_alert_engine.sql"));
    const insertSubscriber = (product: string, email: string) =>
      client.query(
        `insert into shop_alert_subscriber (product, email, consent_text, consent_source, requested_at)
         values ($1, $2, 'x', 'y', now()) returning id`,
        [product, email],
      );
    const id = (await insertSubscriber("art", "rules@example.com")).rows[0].id as string;
    const fails = async (sql: string, params: unknown[] = []) => {
      await client.query("savepoint probe");
      try {
        await client.query(sql, params);
        return false;
      } catch {
        return true;
      } finally {
        await client.query("rollback to savepoint probe");
      }
    };
    // One person can hold a Shop row and a lax.art row, but not two of the same product.
    await insertSubscriber("shop", "rules@example.com");
    expect(
      await fails(
        `insert into shop_alert_subscriber (product, email, consent_text, consent_source, requested_at) values ('art', 'rules@example.com', 'x', 'y', now())`,
      ),
    ).toBe(true);
    expect(
      await fails(
        `insert into shop_alert_subscriber (product, email, consent_text, consent_source, requested_at) values ('bid', 'b@example.com', 'x', 'y', now())`,
      ),
    ).toBe(true);
    expect(
      await fails(
        `insert into shop_alert_topic (subscriber_id, topic) values ($1, 'bid.new_sales')`,
        [id],
      ),
    ).toBe(true);
    await client.query(
      `insert into shop_alert_digest (subscriber_id, product, local_date, item_count, outbox_idempotency_key) values ($1, 'art', '2026-11-03', 1, 'k1')`,
      [id],
    );
    expect(
      await fails(
        `insert into shop_alert_digest (subscriber_id, product, local_date, item_count, outbox_idempotency_key) values ($1, 'art', '2026-11-03', 2, 'k2')`,
        [id],
      ),
    ).toBe(true);
    await client.query(
      `insert into shop_alert_match (subscriber_id, topic, item_key, snapshot) values ($1, 'art.followed_artists', 'artwork:1', '{}')`,
      [id],
    );
    expect(
      await fails(
        `insert into shop_alert_match (subscriber_id, topic, item_key, snapshot) values ($1, 'art.followed_artists', 'artwork:1', '{}')`,
        [id],
      ),
    ).toBe(true);
  });

  it("rolls back to the previous shape and leaves the release list alone", async () => {
    const id = await releaseSubscriber({
      email: "kept@example.com",
      status: "confirmed",
      token: "t-kept",
    });
    await client.query(read("0292_shop_alert_engine.sql"));
    await client.query(read("0292_rollback.sql"));
    const tables = await client.query("select to_regclass('shop_alert_subscriber') as t");
    expect(tables.rows[0].t).toBeNull();
    const kept = await client.query(
      "select status from shop_release_alert_subscription where id = $1",
      [id],
    );
    expect(kept.rows[0].status).toBe("confirmed");
  });
});
