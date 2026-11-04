import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { BidAlertLotNoticeWriter } from "./bid-alert-lot-notice.writer.js";

const url = process.env.DATABASE_URL;
const HAS_DB = Boolean(url);
// biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
const db = HAS_DB ? createDb(url!) : (null as never);

const created: { users: string[] } = { users: [] };

async function insertUser(): Promise<string> {
  const id = randomUUID();
  await db.execute(
    sql`insert into "user" (id, email, name, created_at, updated_at) values (${id}, ${`${id}@example.com`}, 'Probe', now(), now())`,
  );
  created.users.push(id);
  return id;
}

async function insertDigest(userId: string, localDate: string): Promise<string> {
  const subscriberId = randomUUID();
  await db.execute(sql`
    insert into bid_alert_subscriber
      (id, product, email, user_id, status, consent_text, consent_source, requested_at, confirmed_at)
    values (${subscriberId}, 'bid', ${`${subscriberId}@example.com`}, ${userId}, 'confirmed', 'x', 'y', now(), now())`);
  const digestId = randomUUID();
  await db.execute(sql`
    insert into bid_alert_digest (id, subscriber_id, product, local_date, item_count, outbox_idempotency_key)
    values (${digestId}, ${subscriberId}, 'bid', ${localDate}::date, 3, ${`k:${digestId}`})`);
  return digestId;
}

const artistNotice = {
  type: "artist_lots_listed",
  title: "3 new lots by Iris Calder",
  message: "Including Chrome Horizon",
  linkPath: "/artist/iris-calder/a1",
} as const;
const searchNotice = {
  type: "search_lots_listed",
  title: "2 new lots matching “Bronze”",
  message: "Including Head",
  linkPath: "/search?q=bronze",
} as const;

afterAll(async () => {
  if (!HAS_DB) return;
  // Leave no notice behind: other migration tests rebuild the type check on a shared database.
  for (const id of created.users) {
    await db.execute(sql`delete from notification where user_id = ${id}`);
    await db.execute(sql`delete from bid_alert_subscriber where user_id = ${id}`);
    await db.execute(sql`delete from notification_preference where user_id = ${id}`);
    await db.execute(sql`delete from "user" where id = ${id}`);
  }
});

describe.skipIf(!HAS_DB)("Bid lot notices (Postgres)", () => {
  it("writes one notice per type for a digest, with its link, and none again for the same digest", async () => {
    const userId = await insertUser();
    const digestId = await insertDigest(userId, "2026-11-03");
    const writer = new BidAlertLotNoticeWriter(db);
    const input = { digestId, userId, notices: [artistNotice, searchNotice] };
    expect(await writer.write(input)).toBe(2);
    expect(await writer.write(input)).toBe(0);
    const rows = await db.execute(
      sql`select type, title, link_path, alert_digest_id from notification where user_id = ${userId} order by type`,
    );
    expect(rows.rows).toEqual([
      {
        type: "artist_lots_listed",
        title: artistNotice.title,
        link_path: artistNotice.linkPath,
        alert_digest_id: digestId,
      },
      {
        type: "search_lots_listed",
        title: searchNotice.title,
        link_path: searchNotice.linkPath,
        alert_digest_id: digestId,
      },
    ]);
  });

  it("tells the person again on the next digest day", async () => {
    const userId = await insertUser();
    const writer = new BidAlertLotNoticeWriter(db);
    const monday = await insertDigest(userId, "2026-11-02");
    const tuesday = await insertDigest(userId, "2026-11-03");
    expect(await writer.write({ digestId: monday, userId, notices: [artistNotice] })).toBe(1);
    expect(await writer.write({ digestId: tuesday, userId, notices: [artistNotice] })).toBe(1);
  });

  it("respects each app switch on its own", async () => {
    const userId = await insertUser();
    await db.execute(
      sql`insert into notification_preference (user_id, artist_alerts_in_app, search_alerts_in_app) values (${userId}, false, true)`,
    );
    const digestId = await insertDigest(userId, "2026-11-03");
    const writer = new BidAlertLotNoticeWriter(db);
    expect(await writer.write({ digestId, userId, notices: [artistNotice, searchNotice] })).toBe(1);
    const rows = await db.execute(sql`select type from notification where user_id = ${userId}`);
    expect(rows.rows).toEqual([{ type: "search_lots_listed" }]);
  });

  it("writes by default when the person never set a preference", async () => {
    const userId = await insertUser();
    const digestId = await insertDigest(userId, "2026-11-03");
    const writer = new BidAlertLotNoticeWriter(db);
    expect(await writer.write({ digestId, userId, notices: [artistNotice] })).toBe(1);
  });

  it("refuses a link that leaves the site", async () => {
    const userId = await insertUser();
    const digestId = await insertDigest(userId, "2026-11-03");
    const writer = new BidAlertLotNoticeWriter(db);
    await expect(
      writer.write({
        digestId,
        userId,
        notices: [{ ...artistNotice, linkPath: "//evil.example/x" }],
      }),
    ).rejects.toThrow();
  });
});
