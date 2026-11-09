import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { collectionException, collectionPlace } from "@auction/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SaveCollectionSettings } from "../interfaces/collection-settings.repository.js";
import { DrizzleCollectionSettingsRepository } from "./drizzle-collection-settings.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** The year a test place is read in: fixed, so the holidays and sale below never move. */
const NOW = new Date("2031-03-10T12:00:00Z");
const RANGE = { from: "2031-01-01", to: "2031-12-31" };

describe.skipIf(!HAS_DB)("collection settings (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const staffId = `col-set-staff-${run}`;
  const entityId = randomUUID();
  const venueId = randomUUID();
  const otherVenueId = randomUUID();
  const saleId = randomUUID();

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const settings = new DrizzleCollectionSettingsRepository(db);

  /** Each save is a minute after the last, so a stale copy is told apart by its version. */
  let saves = 0;

  async function current() {
    const record = await settings.read(venueId, RANGE, NOW);
    if (!record) throw new Error("The test place was not found");
    return record;
  }

  function save(
    record: Awaited<ReturnType<typeof current>>,
    over: Partial<SaveCollectionSettings> = {},
  ): SaveCollectionSettings {
    const s = record.settings;
    return {
      venueId,
      expectedUpdatedAt: s.updatedAt,
      rules: {
        visitMinutes: s.visitMinutes,
        placesPerSlot: s.placesPerSlot,
        noticeCutoffLocal: s.noticeCutoffLocal,
        noticeWorkingDays: s.noticeWorkingDays,
        windowDays: s.windowDays,
        closeOnSaleDays: s.closeOnSaleDays,
        undoHandOverMinutes: s.undoHandOverMinutes,
        maxActiveVisits: s.maxActiveVisits,
      },
      onlineBookingEnabled: s.onlineBookingEnabled,
      bookingEmail: s.bookingEmail,
      freeStorageDays: s.freeStorageDays,
      hours: record.hours,
      updatedByUserId: staffId,
      at: new Date(NOW.getTime() + ++saves * 60_000),
      ...over,
    };
  }

  beforeAll(async () => {
    const now = new Date();
    await db.execute(sql`
      insert into "user" (id, name, email, email_verified, created_at, updated_at)
      values (${staffId}, 'Staff', ${`${staffId}@integration.test`}, true, ${now}, ${now})`);
    await db.execute(sql`
      insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
      values (${entityId}, 'Collection settings IT', 'individual', 'private_collector', ${staffId}, 'approved')`);
    await db.execute(sql`
      insert into venue (id, legal_entity_id, name, address_line1, city, postcode, country)
      values (${venueId}, ${entityId}, 'Collection settings IT gallery', '1 Test Street', 'London', 'W1W 6YW', 'GB'),
             (${otherVenueId}, ${entityId}, 'Collection settings IT annexe', '2 Test Street', 'London', 'W1W 6YW', 'GB')`);
    // An onsite sale on 12 and 13 May 2031 (London), at the first place only.
    await db.execute(sql`
      insert into sale (id, title, start_time, end_time, venue_id, delivery_mode, status, created_by_legal_entity_id)
      values (${saleId}, 'Collection settings IT sale', '2031-05-12T09:00:00Z', '2031-05-13T16:00:00Z',
         ${venueId}, 'onsite', 'scheduled', ${entityId})`);
  });

  afterAll(async () => {
    await db.execute(sql`delete from sale where id = ${saleId}`);
    for (const id of [venueId, otherVenueId]) {
      await db.execute(sql`delete from collection_exception where venue_id = ${id}`);
      await db.execute(sql`delete from collection_weekly_hours where venue_id = ${id}`);
      await db.delete(collectionPlace).where(eq(collectionPlace.venueId, id));
      await db.execute(sql`delete from venue where id = ${id}`);
    }
    await db.execute(sql`delete from legal_entity where id = ${entityId}`);
    await db.execute(sql`delete from "user" where id = ${staffId}`);
  });

  it("lists the places, saying which are set up", async () => {
    const choices = await settings.venues();
    const mine = choices.filter((c) => c.venueId === venueId || c.venueId === otherVenueId);
    expect(mine.map((c) => c.name)).toEqual([
      "Collection settings IT annexe",
      "Collection settings IT gallery",
    ]);
  });

  it("sets a place up on first read, with the default hours and England and Wales bank holidays", async () => {
    const record = await current();
    expect(record.settings).toMatchObject({
      onlineBookingEnabled: false,
      visitMinutes: 30,
      placesPerSlot: 2,
      noticeCutoffLocal: "16:00",
    });
    expect(record.hours).toHaveLength(5);
    const holidays = record.exceptions.filter((e) => e.source === "bank_holiday");
    expect(holidays.map((h) => h.startsOn)).toContain("2031-12-25");
    expect(holidays.every((h) => h.kind === "closure" && h.id !== null)).toBe(true);
  });

  it("does not add the holidays twice on a second read", async () => {
    const before = (await current()).exceptions.filter((e) => e.source === "bank_holiday");
    const after = (await current()).exceptions.filter((e) => e.source === "bank_holiday");
    expect(after).toHaveLength(before.length);
  });

  it("works out sale days from the sales at the place, and not for another place", async () => {
    const record = await current();
    const days = record.exceptions.filter((e) => e.source === "sale");
    expect(days).toEqual([
      expect.objectContaining({
        id: null,
        startsOn: "2031-05-12",
        endsOn: "2031-05-13",
        saleTitle: "Collection settings IT sale",
      }),
    ]);
    expect(record.nextSaleDay).toEqual({
      saleId,
      saleTitle: "Collection settings IT sale",
      startsOn: "2031-05-12",
    });
    const other = await settings.read(otherVenueId, RANGE, NOW);
    expect(other?.exceptions.some((e) => e.source === "sale")).toBe(false);
  });

  it("answers null for a place that does not exist", async () => {
    expect(await settings.read(randomUUID(), RANGE, NOW)).toBeNull();
  });

  it("saves rules and hours, naming only what changed, and runs the audit step in the same transaction", async () => {
    const record = await current();
    let audited: string[] | null = null;
    const outcome = await settings.save(
      save(record, {
        onlineBookingEnabled: true,
        rules: { ...save(record).rules, visitMinutes: 45 },
        hours: [{ weekday: 1, opensLocal: "09:00", closesLocal: "17:00" }],
      }),
      async (_tx, saved) => {
        audited = saved.changed;
      },
    );
    expect(outcome.outcome).toBe("saved");
    expect(audited).toEqual(["online_booking_enabled", "visit_minutes", "weekly_hours"]);
    const after = await current();
    expect(after.settings).toMatchObject({ onlineBookingEnabled: true, visitMinutes: 45 });
    expect(after.hours).toEqual([{ weekday: 1, opensLocal: "09:00", closesLocal: "17:00" }]);
  });

  it("refuses a save made on a copy that has since changed, and changes nothing", async () => {
    const record = await current();
    const first = await settings.save(save(record, { bookingEmail: "first@example.test" }));
    expect(first.outcome).toBe("saved");
    const second = await settings.save(save(record, { bookingEmail: "second@example.test" }));
    expect(second.outcome).toBe("stale");
    expect((await current()).settings.bookingEmail).toBe("first@example.test");
  });

  it("rolls the save back when the audit step fails", async () => {
    const record = await current();
    await expect(
      settings.save(save(record, { bookingEmail: "lost@example.test" }), async () => {
        throw new Error("audit unavailable");
      }),
    ).rejects.toThrow("audit unavailable");
    expect((await current()).settings.bookingEmail).not.toBe("lost@example.test");
  });

  it("stops a change whose guard refuses, before it writes anything", async () => {
    const record = await current();
    let guarded = false;
    const outcome = await settings.save(
      save(record, { bookingEmail: "refused@example.test" }),
      undefined,
      async () => {
        guarded = true;
        return false;
      },
    );
    expect(guarded).toBe(true);
    expect(outcome.outcome).toBe("affected_changed");
    expect((await current()).settings.bookingEmail).not.toBe("refused@example.test");

    const added = await settings.addException(
      {
        venueId,
        draft: {
          kind: "closure",
          startsOn: "2031-10-01",
          endsOn: "2031-10-01",
          opensLocal: null,
          closesLocal: null,
        },
        reasonInternal: null,
        createdByUserId: staffId,
      },
      undefined,
      async () => false,
    );
    expect(added.outcome).toBe("affected_changed");
    expect((await current()).exceptions.some((e) => e.startsOn === "2031-10-01")).toBe(false);
  });

  it("holds the place's lock for the whole change: a second change waits for the first", async () => {
    const record = await current();
    const order: string[] = [];
    const first = settings.save(
      save(record, { bookingEmail: "first-lock@example.test" }),
      async () => {
        order.push("first writes");
        await new Promise((resolve) => setTimeout(resolve, 300));
        order.push("first done");
      },
    );
    // Starts while the first holds the lock; it is refused as stale only after the first finishes.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = settings.save(
      save(record, { bookingEmail: "second-lock@example.test" }),
      async () => {
        order.push("second writes");
      },
    );
    const [a, b] = await Promise.all([first, second]);
    expect(a.outcome).toBe("saved");
    expect(b.outcome).toBe("stale");
    expect(order).toEqual(["first writes", "first done"]);
  });

  it("adds a closure, shows it, and removes it again without erasing it", async () => {
    const added = await settings.addException({
      venueId,
      draft: {
        kind: "closure",
        startsOn: "2031-12-24",
        endsOn: "2031-12-24",
        opensLocal: "13:00",
        closesLocal: "14:00",
      },
      reasonInternal: "Staff party",
      createdByUserId: staffId,
    });
    if (added.outcome !== "added") throw new Error("The closure was not added");
    const shown = (await current()).exceptions.find((e) => e.id === added.exception.id);
    expect(shown).toMatchObject({
      source: "staff",
      reasonInternal: "Staff party",
      opensLocal: "13:00",
    });

    const removed = await settings.removeException({
      venueId,
      exceptionId: added.exception.id as string,
      at: NOW,
    });
    expect(removed.outcome).toBe("removed");
    expect((await current()).exceptions.some((e) => e.id === added.exception.id)).toBe(false);
    const [row] = await db
      .select()
      .from(collectionException)
      .where(eq(collectionException.id, added.exception.id as string));
    expect(row?.deletedAt).not.toBeNull();
  });

  it("does not remove a closure through another place's address", async () => {
    const added = await settings.addException({
      venueId,
      draft: {
        kind: "closure",
        startsOn: "2031-11-03",
        endsOn: "2031-11-03",
        opensLocal: null,
        closesLocal: null,
      },
      reasonInternal: null,
      createdByUserId: staffId,
    });
    if (added.outcome !== "added") throw new Error("The closure was not added");
    const attempt = await settings.removeException({
      venueId: otherVenueId,
      exceptionId: added.exception.id as string,
      at: NOW,
    });
    expect(attempt.outcome).toBe("not_found");
    expect((await current()).exceptions.some((e) => e.id === added.exception.id)).toBe(true);
  });

  it("does not bring a bank holiday back after staff removed it", async () => {
    const holiday = (await current()).exceptions.find(
      (e) => e.source === "bank_holiday" && e.startsOn === "2031-12-25",
    );
    expect(holiday?.id).toBeTruthy();
    const removed = await settings.removeException({
      venueId,
      exceptionId: holiday?.id as string,
      at: NOW,
    });
    expect(removed.outcome).toBe("removed");
    expect(
      (await current()).exceptions.some(
        (e) => e.source === "bank_holiday" && e.startsOn === "2031-12-25",
      ),
    ).toBe(false);
    const live = await db
      .select()
      .from(collectionException)
      .where(
        and(
          eq(collectionException.venueId, venueId),
          eq(collectionException.startsOn, "2031-12-25"),
          isNull(collectionException.deletedAt),
        ),
      );
    expect(live).toHaveLength(0);
  });

  it("answers venue_not_found when adding to a place that does not exist", async () => {
    const outcome = await settings.addException({
      venueId: randomUUID(),
      draft: {
        kind: "closure",
        startsOn: "2031-11-04",
        endsOn: "2031-11-04",
        opensLocal: null,
        closesLocal: null,
      },
      reasonInternal: null,
      createdByUserId: staffId,
    });
    expect(outcome.outcome).toBe("venue_not_found");
  });
});
