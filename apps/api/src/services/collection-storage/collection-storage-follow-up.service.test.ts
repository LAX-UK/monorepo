import { describe, expect, it, vi } from "vitest";
import { InMemoryStorageFollowUp, waitingLot } from "../../testing/in-memory-storage-follow-up.js";
import { CollectionStorageFollowUpService } from "./collection-storage-follow-up.service.js";

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const OTHER_VENUE = "d0000000-0000-4000-8000-0000000000bb";
/** Mon 16 Nov 2026, London. */
const NOW = new Date("2026-11-16T12:00:00Z");
const ACTOR = { userId: "staff-1" };

const OVER = "e0000000-0000-4000-8000-000000000001";
const LONG_OVER = "e0000000-0000-4000-8000-000000000002";
const LEGACY = "e0000000-0000-4000-8000-000000000003";
const NOT_YET = "e0000000-0000-4000-8000-000000000004";

function setup() {
  const storage = new InMemoryStorageFollowUp();
  const log = vi.fn();
  const venues = vi.fn().mockResolvedValue([
    { venueId: VENUE, name: "Gallery", hasPlace: true, onlineBookingEnabled: true },
    { venueId: OTHER_VENUE, name: "Annexe", hasPlace: true, onlineBookingEnabled: true },
  ]);
  storage.lots.set(VENUE, [
    // Cleared Thu 1 Oct: 14 days free, collect by Thu 15 Oct; 32 days charged to Mon 16 Nov.
    waitingLot({ lotId: OVER }),
    // Cleared Sat 1 Aug: the 14th day is Sat 15 Aug, so collect by Mon 17 Aug; 91 days over.
    waitingLot({
      lotId: LONG_OVER,
      lotNumber: 3,
      clearedAt: new Date("2026-08-01T10:00:00Z"),
      storage: { pricing: { large: true } },
    }),
    // Won before the place had terms: 30 days free from Tue 1 Sep, nothing charged.
    waitingLot({
      lotId: LEGACY,
      lotNumber: 7,
      clearedAt: new Date("2026-09-01T10:00:00Z"),
      storage: { pricing: { terms: null } },
    }),
    // Cleared Tue 10 Nov: collect by Tue 24 Nov, not over yet.
    waitingLot({ lotId: NOT_YET, clearedAt: new Date("2026-11-10T10:00:00Z") }),
  ]);
  const service = new CollectionStorageFollowUpService({
    storage,
    places: { venues },
    now: () => NOW,
    log,
  });
  return { service, storage, log };
}

describe("a place with more waiting lots than the list reads", () => {
  it("finds the one lot to extend or waive directly, and reports the true total when cut", async () => {
    const { service, storage } = setup();
    // 205 lots past their day, listed 200 at a time, and a waiting lot beyond the read limit.
    const many = Array.from({ length: 205 }, (_, n) =>
      waitingLot({
        lotId: `e1000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        clearedAt: new Date("2026-08-01T10:00:00Z"),
      }),
    );
    storage.lots.set(VENUE, [...many, waitingLot({ lotId: OVER })]);
    const list = (await service.overdue(VENUE))._unsafeUnwrap();
    expect(list.lots).toHaveLength(200);
    expect(list.more).toBe(true);
    expect(list.total).toBe(206);
    const asked = vi.spyOn(storage, "waitingLotsAt");
    const waived = await service.waive(ACTOR, VENUE, OVER, { reason: "Agreed with the buyer" });
    expect(waived.isOk()).toBe(true);
    expect(asked).toHaveBeenCalledWith(VENUE, expect.any(Number), expect.any(String), OVER);
  });
});

describe("lots left past their collect-by day", () => {
  it("lists only lots past their day, longest over first, priced as the buyer's page prices them", async () => {
    const { service } = setup();
    const result = (await service.overdue(VENUE))._unsafeUnwrap();
    expect(result.today).toBe("2026-11-16");
    expect(result.chargingOn).toBe(false);
    expect(result.more).toBe(false);
    expect(result.total).toBe(3);
    expect(result.lots.map((l) => l.lotId)).toEqual([LONG_OVER, LEGACY, OVER]);
    expect(result.lots[0]).toMatchObject({
      collectBy: "2026-08-17",
      daysOver: 91,
      band: "large",
      // 91 days at £6.
      amountPence: 54_600,
      amountDetail: "£546.00 so far (91 days at £6 a day), plus VAT where it applies.",
      followUp: true,
      legacyTerms: false,
      extensionDaysLeft: 30,
    });
    expect(result.lots[2]).toMatchObject({
      lotNumber: 12,
      title: "Harbour at Dusk",
      buyerName: "Example Collector",
      collectBy: "2026-10-15",
      daysOver: 32,
      band: "standard",
      amountPence: 9_600,
      amountDetail: "£96.00 so far (32 days at £3 a day), plus VAT where it applies.",
      followUp: false,
      waived: false,
    });
  });

  it("shows a lot won before the terms as over with nothing owed", async () => {
    const { service } = setup();
    const legacy = (await service.overdue(VENUE))
      ._unsafeUnwrap()
      .lots.find((l) => l.lotId === LEGACY);
    expect(legacy).toMatchObject({
      collectBy: "2026-10-01",
      daysOver: 46,
      amountPence: 0,
      amountDetail: null,
      legacyTerms: true,
    });
  });

  it("flags a lot for follow-up from 60 days over, not before", async () => {
    const { service, storage } = setup();
    storage.lots.set(OTHER_VENUE, [
      // Collect by Fri 18 Sep: 59 days over on Mon 16 Nov.
      waitingLot({ lotId: OVER, clearedAt: new Date("2026-09-04T10:00:00Z") }),
      // Collect by Thu 17 Sep: 60 days over.
      waitingLot({ lotId: LONG_OVER, clearedAt: new Date("2026-09-03T10:00:00Z") }),
    ]);
    const lots = (await service.overdue(OTHER_VENUE))._unsafeUnwrap().lots;
    expect(lots.map((l) => [l.daysOver, l.followUp])).toEqual([
      [60, true],
      [59, false],
    ]);
  });

  it("leaves out a lot the rules cannot price, and says so, without failing the list", async () => {
    const { service, storage, log } = setup();
    storage.lots.get(VENUE)?.push(
      waitingLot({
        lotId: "e0000000-0000-4000-8000-0000000000ff",
        storage: {
          pricing: {
            terms: {
              freeDays: 400,
              countMode: "calendar",
              standardDailyPence: 300,
              largeDailyPence: null,
              handlingFeePence: 0,
              effectiveFrom: "2026-01-01",
            },
          },
        },
      }),
      waitingLot({
        lotId: "e0000000-0000-4000-8000-0000000000fe",
        storage: { calendar: undefined },
      }),
    );
    const lots = (await service.overdue(VENUE))._unsafeUnwrap().lots;
    expect(lots).toHaveLength(3);
    expect(log).toHaveBeenCalledWith(
      "collection_storage_lot_unpriced",
      expect.objectContaining({ lotId: "e0000000-0000-4000-8000-0000000000ff" }),
    );
  });

  it("reads the charging switch for a place with nothing waiting", async () => {
    const { service, storage } = setup();
    storage.charging.set(OTHER_VENUE, { raiseInvoices: true, vatTreatment: "standard_rated" });
    expect((await service.overdue(OTHER_VENUE))._unsafeUnwrap()).toMatchObject({
      chargingOn: true,
      lots: [],
    });
  });

  it("refuses a place it does not know", async () => {
    const { service } = setup();
    const result = await service.overdue("d0000000-0000-4000-8000-0000000000cc");
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "venue_not_found", status: 404 });
  });
});

describe("extending a lot's free storage", () => {
  it("adds the days, audits the collect-by day and amount before and after, and answers with the list", async () => {
    const { service, storage } = setup();
    const result = await service.extend(ACTOR, VENUE, OVER, { days: 7, reason: "Buyer abroad" });
    const over = result._unsafeUnwrap().lots.find((l) => l.lotId === OVER);
    // Thu 15 Oct + 7 = Thu 22 Oct; 25 days charged.
    expect(over).toMatchObject({
      collectBy: "2026-10-22",
      daysOver: 25,
      amountPence: 7_500,
      extensionDays: 7,
      extensionDaysLeft: 23,
    });
    expect(storage.audit[0]).toMatchObject({
      lotId: OVER,
      action: "extension_granted",
      actorUserId: "staff-1",
      createdAt: NOW,
      before: { extensionDays: 0, collectBy: "2026-10-15", amountPence: 9_600 },
      after: { extensionDays: 7, days: 7, collectBy: "2026-10-22", amountPence: 7_500 },
      reason: "Buyer abroad",
    });
  });

  it("takes a lot off the list once its new day is today or later", async () => {
    const { service } = setup();
    // Thu 15 Oct + 30 = Sat 14 Nov, a closed day, so Mon 16 Nov: today, not over.
    const result = await service.extend(ACTOR, VENUE, OVER, { days: 30, reason: "Long trip" });
    expect(result._unsafeUnwrap().lots.map((l) => l.lotId)).not.toContain(OVER);
  });

  it("refuses more than 30 days in all, naming what is left on the field", async () => {
    const { service, storage } = setup();
    await service.extend(ACTOR, VENUE, LONG_OVER, { days: 25, reason: "First" });
    const refused = await service.extend(ACTOR, VENUE, LONG_OVER, { days: 6, reason: "Second" });
    expect(refused._unsafeUnwrapErr()).toEqual({
      code: "extension_cap_reached",
      status: 409,
      message: "This lot can have up to 5 more days.",
      issues: [{ field: "days", message: "This lot can have up to 5 more days." }],
    });
    await service.extend(ACTOR, VENUE, LONG_OVER, { days: 5, reason: "Last" });
    const none = await service.extend(ACTOR, VENUE, LONG_OVER, { days: 1, reason: "More" });
    expect(none._unsafeUnwrapErr().message).toBe("This lot has had the most free days it can: 30.");
    expect(storage.audit.filter((a) => a.action === "extension_granted")).toHaveLength(2);
  });

  it("refuses a lot that is not waiting at the place", async () => {
    const { service, storage } = setup();
    const result = await service.extend(ACTOR, OTHER_VENUE, OVER, { days: 3, reason: "x" });
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "lot_not_found", status: 404 });
    expect(storage.audit).toEqual([]);
  });
});

describe("waiving a lot's storage charges", () => {
  it("waives, audits the amount given up, and the list shows nothing owed", async () => {
    const { service, storage } = setup();
    const result = await service.waive(ACTOR, VENUE, OVER, { reason: "Frame damaged in store" });
    expect(result._unsafeUnwrap().lots.find((l) => l.lotId === OVER)).toMatchObject({
      waived: true,
      amountPence: 0,
      amountDetail: null,
    });
    expect(storage.audit[0]).toMatchObject({
      lotId: OVER,
      action: "waiver_granted",
      actorUserId: "staff-1",
      before: { waived: false, amountPence: 9_600 },
      after: { waived: true, amountPence: 0 },
      reason: "Frame damaged in store",
    });
  });

  it("refuses a second waiver and a lot that is not waiting at the place", async () => {
    const { service } = setup();
    await service.waive(ACTOR, VENUE, OVER, { reason: "Goodwill" });
    expect(
      (await service.waive(ACTOR, VENUE, OVER, { reason: "Again" }))._unsafeUnwrapErr(),
    ).toMatchObject({
      code: "already_waived",
      status: 409,
    });
    expect(
      (await service.waive(ACTOR, OTHER_VENUE, OVER, { reason: "x" }))._unsafeUnwrapErr(),
    ).toMatchObject({ code: "lot_not_found" });
  });
});
