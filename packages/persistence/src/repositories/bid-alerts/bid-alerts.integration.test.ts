import { randomUUID } from "node:crypto";
import { type PendingMatch, matchSnapshotSchema } from "@auction/alerts";
import { describeAlertStoreContract } from "@auction/alerts/testing";
import { createDb } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  BidAlertAnnouncementStore,
  BidAlertDigestLedger,
  BidAlertMatchLedger,
  BidAlertMatchValidator,
  BidAlertSaleNoticeWriter,
  BidAlertSaleReader,
  BidAlertSeed,
  BidAlertSubscriberStore,
  BidAlertTopicStore,
} from "./index.js";

const url = process.env.DATABASE_URL;
const HAS_DB = Boolean(url);
// biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
const db = HAS_DB ? createDb(url!) : (null as never);

async function clean() {
  await db.execute(
    sql`TRUNCATE bid_alert_match, bid_alert_digest, bid_alert_topic, bid_alert_subscriber, bid_alert_announcement CASCADE`,
  );
}

async function createStores() {
  await clean();
  return {
    subscribers: new BidAlertSubscriberStore(db),
    topics: new BidAlertTopicStore(db),
    matches: new BidAlertMatchLedger(db),
    digests: new BidAlertDigestLedger(db),
    announcements: new BidAlertAnnouncementStore(db),
    newSubjectId: insertUser,
  };
}

if (HAS_DB) {
  describeAlertStoreContract("Postgres (Bid)", "bid", createStores);
} else {
  describe.skip("alert stores: Postgres (Bid)", () => it("needs DATABASE_URL", () => undefined));
}

const NOW = new Date("2026-11-03T09:00:00.000Z");

async function insertUser(): Promise<string> {
  const id = randomUUID();
  await db.execute(
    sql`insert into "user" (id, email, name, created_at, updated_at) values (${id}, ${`${id}@example.com`}, 'Probe', now(), now())`,
  );
  return id;
}

let entityId: string | null = null;

async function insertSale(status: string, title = "Modern British and Irish Art"): Promise<string> {
  if (!entityId) {
    const ownerId = await insertUser();
    entityId = randomUUID();
    await db.insert(legalEntity).values({
      id: entityId,
      displayName: "Alert test house",
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: ownerId,
      status: "approved",
    });
  }
  const id = randomUUID();
  await db.execute(sql`
    insert into sale (id, title, status, start_time, end_time, delivery_mode, created_by_legal_entity_id)
    values (${id}, ${title}, ${status}::sale_status, '2026-11-18T10:00:00Z', '2026-11-26T18:00:00Z', 'online', ${entityId})`);
  return id;
}

describe.skipIf(!HAS_DB)("Bid alert adapters (integration)", () => {
  it("turns a sale that was withdrawn or ended into a stale match", async () => {
    const live = await insertSale("scheduled");
    const draft = await insertSale("draft");
    const ended = await insertSale("ended");
    const match = (saleId: string): PendingMatch => ({
      id: randomUUID(),
      subscriberId: randomUUID(),
      topic: "bid.new_sales",
      itemKey: `sale:${saleId}`,
      groupKey: null,
      snapshot: matchSnapshotSchema.parse({ title: "x", path: "/sales/x" }),
      matchedAt: NOW,
    });
    const [a, b, c] = [match(live), match(draft), match(ended)];
    const stale = await new BidAlertMatchValidator(db).staleMatches([a, b, c] as PendingMatch[]);
    expect([...stale.keys()].sort()).toEqual([b?.id, c?.id].sort());
    expect([...stale.values()]).toEqual(["sale_withdrawn", "sale_withdrawn"]);
  });

  it("counts confirmed subscribers with new-sale email on", async () => {
    const { subscribers, topics } = await createStores();
    const reader = new BidAlertSaleReader(db);
    expect(await reader.countEmailSubscribers()).toBe(0);
    for (const [email, on, confirm] of [
      ["a@example.com", true, true],
      ["b@example.com", true, false],
      ["c@example.com", false, true],
    ] as const) {
      const row = await subscribers.savePending({
        product: "bid",
        email,
        consentText: "x",
        consentSource: "y",
        now: NOW,
      });
      if (confirm) await subscribers.confirm(row.id, NOW);
      await topics.setEmail(row.id, "bid.new_sales", on, "person", NOW);
    }
    expect(await reader.countEmailSubscribers()).toBe(1);
  });

  it("writes one in-app notice per signed-in subscriber with the app switch on, once per sale", async () => {
    const { subscribers, topics } = await createStores();
    const saleId = await insertSale("scheduled");
    const on = await insertUser();
    const off = await insertUser();
    const visitor = "visitor@example.com";
    for (const [email, userId] of [
      [`${on}@example.com`, on],
      [`${off}@example.com`, off],
      [visitor, null],
    ] as const) {
      const row = userId
        ? await subscribers.saveConfirmedForAccount({
            product: "bid",
            email,
            subjectId: userId,
            consentText: "x",
            consentSource: "y",
            now: NOW,
          })
        : await subscribers.savePending({
            product: "bid",
            email,
            consentText: "x",
            consentSource: "y",
            now: NOW,
          });
      if (!userId) await subscribers.confirm(row.id, NOW);
      await topics.setEmail(row.id, "bid.new_sales", true, "person", NOW);
    }
    await db.execute(
      sql`insert into notification_preference (user_id, new_sales_in_app) values (${off}, false)`,
    );
    const writer = new BidAlertSaleNoticeWriter(db);
    const input = {
      saleId,
      title: "New sale: Modern British and Irish Art",
      message: "Opens Wed 18 Nov",
    };
    expect(await writer.notifySubscribers(input)).toBe(1);
    expect(await writer.notifySubscribers(input)).toBe(0);
    const rows = await db.execute(
      sql`select user_id, type, sale_id from notification where sale_id = ${saleId}`,
    );
    expect(rows.rows).toEqual([{ user_id: on, type: "sale_announced", sale_id: saleId }]);
    // Leave no notice behind: other migration tests rebuild the type check on a shared database.
    await db.execute(sql`delete from notification where sale_id = ${saleId}`);
  });

  it("seeds every published sale as announced and starts the projector at the newest event", async () => {
    await clean();
    await db.execute(
      sql`delete from projector_state where projector_name = 'bid_alert_matching_test'`,
    );
    const published = await insertSale("scheduled");
    const draft = await insertSale("draft");
    const seed = new BidAlertSeed(db);
    expect(await seed.isSeeded()).toBe(false);
    const first = await seed.run("bid_alert_matching_test", NOW);
    expect(first.alreadySeeded).toBe(false);
    expect(first.alreadyAnnounced).toBeGreaterThanOrEqual(1);
    expect(await seed.isSeeded()).toBe(true);
    const announcements = new BidAlertAnnouncementStore(db);
    expect(await announcements.claimItem(`sale:${published}`, true, NOW)).toMatchObject({
      first: false,
      announce: false,
      expanded: true,
    });
    expect((await announcements.claimItem(`sale:${draft}`, true, NOW)).first).toBe(true);
    expect((await seed.run("bid_alert_matching_test", NOW)).alreadySeeded).toBe(true);
    await db.execute(
      sql`delete from projector_state where projector_name = 'bid_alert_matching_test'`,
    );
  });
});
