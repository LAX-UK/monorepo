import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionBooking } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CollectionsCategory } from "./collections.category.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Whose bookings a person's download holds. Two members of one organisation book separately; each
 * download has the bookings the person made or is named in, and never the other member's.
 */
describe.skipIf(!HAS_DB)("Download my data: collections (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const owner = `col-exp-owner-${run}`;
  const colleague = `col-exp-colleague-${run}`;
  const stranger = `col-exp-stranger-${run}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const category = new CollectionsCategory({
    db,
    files: {} as never,
    webOrigin: "https://bid.example",
  });

  const ids: Record<string, string> = {};
  let slot = 0;
  async function booking(name: string, over: Record<string, unknown>) {
    slot += 1;
    const start = new Date(Date.UTC(2033, 0, 1, 10, 0) + slot * 30 * 60_000);
    const [row] = await db
      .insert(collectionBooking)
      .values({
        legalEntityId: entityId,
        venueId,
        slotStart: start,
        slotEnd: new Date(start.getTime() + 30 * 60_000),
        seat: 1,
        collectorKind: "self",
        collectorName: "Unset",
        idempotencyKey: randomUUID(),
        requestFingerprint: randomUUID(),
        ...over,
      } as typeof collectionBooking.$inferInsert)
      .returning({ id: collectionBooking.id });
    ids[name] = (row as { id: string }).id;
  }

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${owner}, 'Owner', ${`${owner}@integration.test`}, true, ${now}, ${now}),
             (${colleague}, 'Colleague', ${`${colleague}@integration.test`}, true, ${now}, ${now}),
             (${stranger}, 'Stranger', ${`${stranger}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Export IT organisation', 'organisation', 'gallery', ${owner}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Export IT gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB')`);
    // The owner booked a visit for a shipper they authorised.
    await booking("ownerThirdParty", {
      bookedByUserId: owner,
      collectorKind: "third_party",
      collectorName: "Sam Okoro",
      collectorEmail: "sam@example.com",
      collectorCompany: "Okoro Shipping",
      authorisedByUserId: owner,
      authorisedAt: now,
    });
    // The colleague booked two visits of their own, one for a shipper they authorised.
    await booking("colleagueSelf", {
      bookedByUserId: colleague,
      collectorKind: "self",
      collectorName: "Colleague Name",
    });
    await booking("colleagueThirdParty", {
      bookedByUserId: colleague,
      collectorKind: "third_party",
      collectorName: "Pat Colleague-Shipper",
      collectorEmail: "pat@colleague-shipper.example",
      collectorCompany: "Colleague Shipping",
      authorisedByUserId: colleague,
      authorisedAt: now,
    });
    // The colleague booked a visit and named the owner as the person who collects.
    await booking("colleagueNamesOwner", {
      bookedByUserId: colleague,
      collectorKind: "member",
      collectorName: "Owner Name",
      collectorUserId: owner,
    });
    // Staff booked a visit for the organisation, naming nobody who has an account.
    await booking("staffForOrganisation", {
      bookedByUserId: null,
      bookedVia: "staff",
      collectorKind: "self",
      collectorName: "Walk-in Visitor",
    });
  });

  afterAll(async () => {
    await db.execute(sql`delete from collection_booking where venue_id = ${venueId}`);
    await db.execute(sql`delete from venue where id = ${venueId}`);
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(sql`delete from "user" where id in (${owner}, ${colleague}, ${stranger})`);
  });

  async function download(subject: string) {
    const page = await category.readPage(subject, null);
    return page.records as Array<Record<string, unknown> & { id: string }>;
  }

  it("holds the bookings the owner made or is named in, and not the colleague's other bookings", async () => {
    const records = await download(owner);
    expect(records.map((r) => r.id).sort()).toEqual(
      [ids.ownerThirdParty, ids.colleagueNamesOwner].sort(),
    );
    expect(await category.count(owner)).toBe(2);
    const text = JSON.stringify(records);
    for (const secret of [
      "Colleague Name",
      "Pat Colleague-Shipper",
      "pat@colleague-shipper.example",
      "Colleague Shipping",
      "Walk-in Visitor",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("gives the owner the collector details they typed in", async () => {
    const records = await download(owner);
    const own = records.find((r) => r.id === ids.ownerThirdParty);
    expect(own).toMatchObject({
      yourRoles: ["booker", "authoriser"],
      bookedBy: "you",
      collector: {
        kind: "third_party",
        name: "Sam Okoro",
        email: "sam@example.com",
        company: "Okoro Shipping",
      },
    });
  });

  it("shows a booking a colleague made for the owner as made by another member, never by name", async () => {
    const records = await download(owner);
    const named = records.find((r) => r.id === ids.colleagueNamesOwner);
    expect(named).toMatchObject({ yourRoles: ["collector"], bookedBy: "another_member" });
    expect(JSON.stringify(named)).not.toContain(colleague);
  });

  it("holds the colleague's own three bookings, and not the owner's", async () => {
    const records = await download(colleague);
    expect(records.map((r) => r.id).sort()).toEqual(
      [ids.colleagueSelf, ids.colleagueThirdParty, ids.colleagueNamesOwner].sort(),
    );
    expect(JSON.stringify(records)).not.toContain("Sam Okoro");
  });

  it("holds nothing for someone with no part in any booking, or a booking made by staff", async () => {
    expect(await download(stranger)).toEqual([]);
    expect(await category.count(stranger)).toBe(0);
    const all = [...(await download(owner)), ...(await download(colleague))].map((r) => r.id);
    expect(all).not.toContain(ids.staffForOrganisation);
  });

  it("never carries staff-only or internal fields", async () => {
    const text = JSON.stringify([...(await download(owner)), ...(await download(colleague))]);
    for (const field of [
      "idempotencyKey",
      "requestFingerprint",
      "overCapacityReason",
      "outcomeByUserId",
      "cancelledByUserId",
      "policyVersion",
      "legalEntityId",
    ]) {
      expect(text).not.toContain(field);
    }
  });
});
