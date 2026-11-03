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

const consent = "We'll email you when LAX Bid announces new sales.";

/** Runs in one transaction that is always rolled back, on a database already migrated. */
describe.skipIf(!migrationUrl)("migration 0284 alert engine", { timeout: 30_000 }, () => {
  let client: pg.Client;
  let userId: string;

  async function visitor(
    email: string,
    status: "pending" | "confirmed" | "unsubscribed",
    linkedUserId: string | null = null,
  ): Promise<string> {
    const row = await client.query(
      `insert into visitor_sale_alert_subscriber
         (email, status, consent_text, consent_source, requested_at, confirmation_sent_at,
          confirmed_at, unsubscribed_at, linked_user_id)
       values ($1, $2, $3, 'web_home_alerts', '2026-10-30T09:00:00Z', '2026-10-30T09:00:00Z',
          case when $2 = 'confirmed' then '2026-10-30T09:05:00Z'::timestamptz end,
          case when $2 = 'unsubscribed' then '2026-10-31T09:00:00Z'::timestamptz end, $4)
       returning id`,
      [email, status, consent, linkedUserId],
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
    const user = await client.query(
      `insert into "user" (id, email, name, created_at, updated_at) values (gen_random_uuid()::text, $1, 'Probe', now(), now()) returning id`,
      [`probe-${Date.now()}@example.com`],
    );
    userId = user.rows[0].id as string;
  });

  it("moves every visitor subscriber with its id, state and consent record", async () => {
    const confirmed = await visitor("Confirmed@Example.com", "confirmed", userId);
    const pending = await visitor("pending@example.com", "pending");
    const stopped = await visitor("stopped@example.com", "unsubscribed");
    await client.query(read("0284_alert_engine.sql"));

    const rows = await client.query(
      `select id, email, user_id, status, consent_text, consent_source, requested_at, confirmed_at,
              stopped_at, stop_reason, link_version
       from bid_alert_subscriber where id = any($1) order by email`,
      [[confirmed, pending, stopped]],
    );
    expect(rows.rows.map((r) => [r.id, r.email, r.status])).toEqual([
      [confirmed, "confirmed@example.com", "confirmed"],
      [pending, "pending@example.com", "pending"],
      [stopped, "stopped@example.com", "stopped"],
    ]);
    const [c, p, s] = rows.rows;
    expect(c.user_id).toBe(userId);
    expect(c.consent_text).toBe(consent);
    expect(c.consent_source).toBe("web_home_alerts");
    expect(c.requested_at.toISOString()).toBe("2026-10-30T09:00:00.000Z");
    expect(c.confirmed_at.toISOString()).toBe("2026-10-30T09:05:00.000Z");
    expect(p.requested_at.toISOString()).toBe("2026-10-30T09:00:00.000Z");
    expect(p.confirmed_at).toBeNull();
    expect(s.stopped_at.toISOString()).toBe("2026-10-31T09:00:00.000Z");
    expect(s.stop_reason).toBe("link");
    expect(c.link_version).toBe(1);
  });

  it("switches the new-sales topic on for confirmed addresses only", async () => {
    const confirmed = await visitor("a@example.com", "confirmed");
    const pending = await visitor("b@example.com", "pending");
    const stopped = await visitor("c@example.com", "unsubscribed");
    await client.query(read("0284_alert_engine.sql"));
    const topics = await client.query(
      `select subscriber_id, topic, email_on, changed_by from bid_alert_topic
       where subscriber_id = any($1)`,
      [[confirmed, pending, stopped]],
    );
    const by = new Map(topics.rows.map((r) => [r.subscriber_id, r]));
    expect(by.get(confirmed)).toMatchObject({
      topic: "bid.new_sales",
      email_on: true,
      changed_by: "migration",
    });
    expect(by.get(pending)?.email_on).toBe(false);
    expect(by.get(stopped)?.email_on).toBe(false);
  });

  it("can run twice without changing anything, and keeps changes made after the first run", async () => {
    const id = await visitor("again@example.com", "confirmed");
    await client.query(read("0284_alert_engine.sql"));
    await client.query(
      `update bid_alert_subscriber set status = 'stopped', stop_reason = 'link' where id = $1`,
      [id],
    );
    await client.query(read("0284_alert_engine.sql"));
    const row = await client.query("select status from bid_alert_subscriber where id = $1", [id]);
    expect(row.rows[0].status).toBe("stopped");
  });

  it("holds the rules the engine relies on", async () => {
    await client.query(read("0284_alert_engine.sql"));
    const sub = await client.query(
      `insert into bid_alert_subscriber (product, email, consent_text, consent_source, requested_at)
       values ('bid', 'rules@example.com', 'x', 'y', now()) returning id`,
    );
    const id = sub.rows[0].id as string;
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
    expect(
      await fails(
        `insert into bid_alert_subscriber (product, email, consent_text, consent_source, requested_at) values ('bid', 'Rules@Example.com', 'x', 'y', now())`,
      ),
    ).toBe(true);
    expect(
      await fails(
        `insert into bid_alert_subscriber (product, email, consent_text, consent_source, requested_at) values ('shop', 's@example.com', 'x', 'y', now())`,
      ),
    ).toBe(true);
    expect(
      await fails(
        `insert into bid_alert_topic (subscriber_id, topic) values ($1, 'shop.releases')`,
        [id],
      ),
    ).toBe(true);
    await client.query(
      `insert into bid_alert_digest (subscriber_id, product, local_date, item_count, outbox_idempotency_key) values ($1, 'bid', '2026-11-03', 1, 'k1')`,
      [id],
    );
    expect(
      await fails(
        `insert into bid_alert_digest (subscriber_id, product, local_date, item_count, outbox_idempotency_key) values ($1, 'bid', '2026-11-03', 2, 'k2')`,
        [id],
      ),
    ).toBe(true);
    await client.query(
      `insert into bid_alert_match (subscriber_id, topic, item_key, snapshot) values ($1, 'bid.new_sales', 'sale:1', '{}')`,
      [id],
    );
    expect(
      await fails(
        `insert into bid_alert_match (subscriber_id, topic, item_key, snapshot) values ($1, 'bid.new_sales', 'sale:1', '{}')`,
        [id],
      ),
    ).toBe(true);
  });

  it("accepts the sale notice type and the old ones, and refuses others", async () => {
    await client.query(read("0284_alert_engine.sql"));
    const accepts = async (type: string) => {
      await client.query("savepoint probe");
      try {
        await client.query(
          `insert into notification (user_id, type, title, message) values ($1, $2, 't', 'm')`,
          [userId, type],
        );
        return true;
      } catch {
        return false;
      } finally {
        await client.query("rollback to savepoint probe");
      }
    };
    for (const type of ["sale_announced", "outbid", "watchlist_reminder"])
      expect(await accepts(type)).toBe(true);
    expect(await accepts("not_a_type")).toBe(false);
  });

  it("rolls back to the previous shape and removes the notices it could not keep", async () => {
    await client.query(read("0284_alert_engine.sql"));
    await client.query(
      `insert into notification (user_id, type, title, message)
       values ($1, 'sale_announced', 't', 'm'), ($1, 'outbid', 't', 'm')`,
      [userId],
    );
    await client.query(read("0284_rollback.sql"));
    const tables = await client.query(`select to_regclass('bid_alert_subscriber') as t`);
    expect(tables.rows[0].t).toBeNull();
    const left = await client.query("select type from notification where user_id = $1", [userId]);
    expect(left.rows).toEqual([{ type: "outbid" }]);
    const col = await client.query(
      `select 1 from information_schema.columns where table_name = 'notification' and column_name = 'sale_id'`,
    );
    expect(col.rows).toHaveLength(0);
  });
});
