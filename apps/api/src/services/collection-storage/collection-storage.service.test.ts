import type { StorageTermsValues } from "@auction/persistence/interfaces";
import type { StorageTermsBody } from "@auction/validators";
import type { Result } from "neverthrow";
import { describe, expect, it } from "vitest";
import { InMemoryCollectionStorage } from "../../testing/in-memory-collection-storage.js";
import type { CollectionStorageError } from "./collection-storage.errors.js";
import {
  CollectionStorageAdminService,
  STORAGE_HISTORY_LIMIT,
  splitTerms,
} from "./collection-storage.service.js";

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const OTHER_VENUE = "d0000000-0000-4000-8000-0000000000bb";
/** 15 Nov 2026, midday in London. */
const NOW = new Date("2026-11-15T12:00:00Z");
const FINANCE = { userId: "finance-1" };

const IN_FORCE: StorageTermsValues = {
  effectiveFrom: "2026-11-01",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 300,
  largeDailyPence: 600,
  handlingFeePence: 0,
  reason: "First terms",
};

const CHANGE: StorageTermsBody = {
  effectiveFrom: "2026-12-01",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 350,
  largeDailyPence: 700,
  handlingFeePence: 0,
  reason: "New rates for December",
};

function setup(now = NOW) {
  const storage = new InMemoryCollectionStorage();
  storage.names.set(FINANCE.userId, "Fran Finance");
  const clock = { now };
  const service = new CollectionStorageAdminService({
    storage,
    places: {
      venues: async () => [
        { venueId: VENUE, name: "Gallery", hasPlace: true, onlineBookingEnabled: true },
        { venueId: OTHER_VENUE, name: "Annexe", hasPlace: true, onlineBookingEnabled: false },
      ],
    },
    now: () => clock.now,
  });
  return { storage, service, clock };
}

async function value<T>(promise: Promise<Result<T, CollectionStorageError>>): Promise<T> {
  const result = await promise;
  if (result.isErr()) throw new Error(`Expected ok, got ${result.error.code}`);
  return result.value;
}

async function refusal<T>(
  promise: Promise<Result<T, CollectionStorageError>>,
): Promise<CollectionStorageError> {
  const result = await promise;
  if (result.isOk()) throw new Error("Expected a refusal");
  return result.error;
}

describe("reading the Storage tab", () => {
  it("shows no terms, charging off, and an empty history for a place never set up", async () => {
    const { service } = setup();
    expect(await value(service.get(VENUE))).toEqual({
      venueId: VENUE,
      today: "2026-11-15",
      inForce: null,
      scheduled: null,
      charging: { raiseInvoices: false, vatTreatment: null },
      history: [],
    });
  });

  it("refuses an unknown place", async () => {
    const { service } = setup();
    expect(await refusal(service.get("d0000000-0000-4000-8000-000000000999"))).toMatchObject({
      code: "venue_not_found",
      status: 404,
    });
  });

  it("splits the terms in force from the next change", async () => {
    const { service, storage } = setup();
    storage.seed(VENUE, { ...IN_FORCE, effectiveFrom: "2026-10-01", reason: "Older" });
    const current = storage.seed(VENUE, IN_FORCE);
    const next = storage.seed(VENUE, CHANGE);
    storage.seed(OTHER_VENUE, { ...CHANGE, effectiveFrom: "2026-11-20" });
    const tab = await value(service.get(VENUE));
    expect(tab.inForce).toEqual({
      id: current.id,
      effectiveFrom: "2026-11-01",
      freeDays: 14,
      countMode: "calendar",
      standardDailyPence: 300,
      largeDailyPence: 600,
      handlingFeePence: 0,
      reason: "First terms",
    });
    expect(tab.scheduled?.id).toBe(next.id);
  });

  it("counts a change starting today as in force, using the London day", async () => {
    // 00:30 UTC on 1 Dec is 00:30 in London (GMT), so the change from 1 Dec is in force.
    const { service, storage } = setup(new Date("2026-12-01T00:30:00Z"));
    storage.seed(VENUE, IN_FORCE);
    storage.seed(VENUE, CHANGE);
    const tab = await value(service.get(VENUE));
    expect(tab.today).toBe("2026-12-01");
    expect(tab.inForce?.effectiveFrom).toBe("2026-12-01");
    expect(tab.scheduled).toBeNull();
  });
});

describe("splitTerms", () => {
  it("leaves cancelled versions out", () => {
    const base = {
      ...IN_FORCE,
      id: "t",
      venueId: VENUE,
      createdByUserId: null,
      createdAt: NOW,
    };
    expect(
      splitTerms(
        [
          { ...base, id: "a", cancelledAt: null },
          { ...base, id: "b", effectiveFrom: "2026-12-01", cancelledAt: NOW },
        ],
        "2026-11-15",
      ),
    ).toEqual({ inForce: expect.objectContaining({ id: "a" }), scheduled: null });
  });
});

describe("scheduling a change", () => {
  it("schedules it, audits who, when, before, after and why, and answers with the tab", async () => {
    const { service, storage } = setup();
    storage.seed(VENUE, IN_FORCE);
    const tab = await value(service.schedule(FINANCE, VENUE, CHANGE));
    expect(tab.scheduled).toMatchObject({ effectiveFrom: "2026-12-01", standardDailyPence: 350 });
    expect(storage.audit).toEqual([
      expect.objectContaining({
        venueId: VENUE,
        action: "terms_scheduled",
        actorUserId: "finance-1",
        createdAt: NOW,
        before: null,
        after: expect.objectContaining({ standardDailyPence: 350, largeDailyPence: 700 }),
        reason: "New rates for December",
      }),
    ]);
    expect(tab.history).toEqual([
      expect.objectContaining({
        action: "terms_scheduled",
        who: "Fran Finance",
        at: NOW.toISOString(),
        reason: "New rates for December",
      }),
    ]);
  });

  it("sets the first terms of a place with none", async () => {
    const { service } = setup();
    const tab = await value(service.schedule(FINANCE, VENUE, CHANGE));
    expect(tab.inForce).toBeNull();
    expect(tab.scheduled?.effectiveFrom).toBe("2026-12-01");
  });

  it.each(["2026-11-15", "2026-11-14"])(
    "refuses a start on %s: from tomorrow only",
    async (day) => {
      const { service, storage } = setup();
      expect(
        await refusal(service.schedule(FINANCE, VENUE, { ...CHANGE, effectiveFrom: day })),
      ).toMatchObject({
        code: "start_not_in_future",
        status: 422,
        issues: [{ field: "effectiveFrom", message: "Choose a date from tomorrow." }],
      });
      expect(storage.terms).toEqual([]);
      expect(storage.audit).toEqual([]);
    },
  );

  it("accepts tomorrow", async () => {
    const { service } = setup();
    const tab = await value(
      service.schedule(FINANCE, VENUE, { ...CHANGE, effectiveFrom: "2026-11-16" }),
    );
    expect(tab.scheduled?.effectiveFrom).toBe("2026-11-16");
  });

  it("keeps one change waiting at a time", async () => {
    const { service, storage } = setup();
    storage.seed(VENUE, CHANGE);
    expect(
      await refusal(service.schedule(FINANCE, VENUE, { ...CHANGE, effectiveFrom: "2027-01-01" })),
    ).toMatchObject({ code: "change_already_scheduled", status: 409 });
    expect(storage.audit).toEqual([]);
  });

  it("refuses an unknown place and writes nothing", async () => {
    const { service, storage } = setup();
    expect(
      await refusal(service.schedule(FINANCE, "d0000000-0000-4000-8000-000000000999", CHANGE)),
    ).toMatchObject({ code: "venue_not_found" });
    expect(storage.terms).toEqual([]);
  });
});

describe("editing and cancelling the scheduled change", () => {
  it("edits it and audits the values before and after", async () => {
    const { service, storage } = setup();
    storage.seed(VENUE, IN_FORCE);
    const next = storage.seed(VENUE, CHANGE);
    const tab = await value(
      service.edit(FINANCE, VENUE, next.id, {
        ...CHANGE,
        largeDailyPence: null,
        reason: "Large band not needed",
      }),
    );
    expect(tab.scheduled).toMatchObject({ id: next.id, largeDailyPence: null });
    expect(storage.audit.at(-1)).toMatchObject({
      action: "terms_edited",
      actorUserId: "finance-1",
      before: expect.objectContaining({ largeDailyPence: 700 }),
      after: expect.objectContaining({ largeDailyPence: null }),
      reason: "Large band not needed",
    });
  });

  it("refuses to move it to today", async () => {
    const { service, storage } = setup();
    const next = storage.seed(VENUE, CHANGE);
    expect(
      await refusal(
        service.edit(FINANCE, VENUE, next.id, { ...CHANGE, effectiveFrom: "2026-11-15" }),
      ),
    ).toMatchObject({ code: "start_not_in_future" });
  });

  it("refuses terms that have started: they are history", async () => {
    const { service, storage } = setup();
    const current = storage.seed(VENUE, IN_FORCE);
    expect(await refusal(service.edit(FINANCE, VENUE, current.id, CHANGE))).toMatchObject({
      code: "not_scheduled",
      status: 409,
    });
    expect(
      await refusal(service.cancel(FINANCE, VENUE, current.id, { reason: "Oops" })),
    ).toMatchObject({ code: "not_scheduled" });
  });

  it("refuses a change from another place", async () => {
    const { service, storage } = setup();
    const elsewhere = storage.seed(OTHER_VENUE, CHANGE);
    expect(await refusal(service.edit(FINANCE, VENUE, elsewhere.id, CHANGE))).toMatchObject({
      code: "terms_not_found",
      status: 404,
    });
    expect(
      await refusal(service.cancel(FINANCE, VENUE, "missing", { reason: "Gone" })),
    ).toMatchObject({ code: "terms_not_found" });
  });

  it("cancels it, keeps the terms in force, and audits why", async () => {
    const { service, storage } = setup();
    storage.seed(VENUE, IN_FORCE);
    const next = storage.seed(VENUE, CHANGE);
    const tab = await value(service.cancel(FINANCE, VENUE, next.id, { reason: "Wrong date" }));
    expect(tab.scheduled).toBeNull();
    expect(tab.inForce?.effectiveFrom).toBe("2026-11-01");
    expect(storage.audit.at(-1)).toMatchObject({
      action: "terms_cancelled",
      before: expect.objectContaining({ effectiveFrom: "2026-12-01" }),
      after: null,
      reason: "Wrong date",
    });
    expect(
      await refusal(service.cancel(FINANCE, VENUE, next.id, { reason: "Again" })),
    ).toMatchObject({ code: "not_scheduled" });
  });
});

describe("the charging switch", () => {
  it("stays off until a VAT treatment is chosen, and writes nothing", async () => {
    const { service, storage } = setup();
    expect(
      await refusal(service.setCharging(FINANCE, VENUE, { raiseInvoices: true, reason: "Go" })),
    ).toMatchObject({ code: "vat_treatment_required", status: 409 });
    expect(storage.audit).toEqual([]);
  });

  it("switches on once a treatment exists, and audits it", async () => {
    const { service, storage } = setup();
    storage.charging.set(VENUE, { raiseInvoices: false, vatTreatment: "standard_rated" });
    const tab = await value(
      service.setCharging(FINANCE, VENUE, { raiseInvoices: true, reason: "VAT agreed" }),
    );
    expect(tab.charging).toEqual({ raiseInvoices: true, vatTreatment: "standard_rated" });
    expect(storage.audit.at(-1)).toMatchObject({
      action: "charging_switched",
      before: { raiseInvoices: false },
      after: { raiseInvoices: true },
      reason: "VAT agreed",
    });
  });
});

describe("history", () => {
  it("lists changes to the place, newest first, without per-lot decisions", async () => {
    const { service, storage } = setup();
    storage.audit.push(
      {
        id: "lot-row",
        venueId: VENUE,
        lotId: "lot-1",
        action: "extension_granted",
        actorUserId: null,
        actorName: null,
        before: null,
        after: { days: 7 },
        reason: "Abroad",
        createdAt: new Date("2026-11-10T09:00:00Z"),
      },
      {
        id: "moved",
        venueId: VENUE,
        lotId: null,
        action: "terms_migrated",
        actorUserId: null,
        actorName: null,
        before: { freeStorageDays: 14 },
        after: { freeDays: 14 },
        reason: "Moved",
        createdAt: new Date("2026-11-09T09:00:00Z"),
      },
    );
    await value(service.schedule(FINANCE, VENUE, CHANGE));
    const tab = await value(service.get(VENUE));
    expect(tab.history.map((row) => row.action)).toEqual(["terms_scheduled", "terms_migrated"]);
    expect(tab.history[1]).toMatchObject({ who: null, before: { freeStorageDays: 14 } });
  });

  it(`shows at most ${STORAGE_HISTORY_LIMIT} changes`, async () => {
    const { service, storage } = setup();
    for (let i = 0; i < STORAGE_HISTORY_LIMIT + 5; i++) {
      storage.audit.push({
        id: `row-${i}`,
        venueId: VENUE,
        lotId: null,
        action: "charging_switched",
        actorUserId: null,
        actorName: null,
        before: { raiseInvoices: false },
        after: { raiseInvoices: false },
        reason: null,
        createdAt: new Date(NOW.getTime() - i * 60_000),
      });
    }
    expect((await value(service.get(VENUE))).history).toHaveLength(STORAGE_HISTORY_LIMIT);
  });
});
