import { describe, expect, it } from "vitest";
import {
  bookCollectionBodySchema,
  cancelCollectionBodySchema,
  changeCollectionBodySchema,
  collectionAvailabilityQuerySchema,
  collectionBookingIdParamSchema,
  handOverCollectionBodySchema,
} from "./collection-booking.js";

const LOT_A = "7f1c2a40-0000-4000-8000-0000000000a1";
const LOT_B = "7f1c2a40-0000-4000-8000-0000000000b2";
const collector = { kind: "self", name: "Charlotte Hayes" } as const;
const book = (over: Record<string, unknown> = {}) => ({
  lotIds: [LOT_A],
  slotStart: "2026-11-12T14:00:00Z",
  collector,
  idempotencyKey: "book-0001-abcdef",
  ...over,
});

describe("bookCollectionBodySchema", () => {
  it("accepts a booking and normalises the time to UTC", () => {
    const parsed = bookCollectionBodySchema.parse(book({ slotStart: "2026-11-12T14:00:00+00:00" }));
    expect(parsed.slotStart).toBe("2026-11-12T14:00:00.000Z");
    expect(
      bookCollectionBodySchema.parse(book({ slotStart: "2026-06-12T15:00:00+01:00" })).slotStart,
    ).toBe("2026-06-12T14:00:00.000Z");
  });

  it("needs between 1 and 20 lots, each a UUID", () => {
    expect(bookCollectionBodySchema.safeParse(book({ lotIds: [] })).success).toBe(false);
    expect(bookCollectionBodySchema.safeParse(book({ lotIds: ["lot-1"] })).success).toBe(false);
    const twenty = Array.from(
      { length: 20 },
      (_, i) => `7f1c2a40-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(bookCollectionBodySchema.safeParse(book({ lotIds: twenty })).success).toBe(true);
    expect(bookCollectionBodySchema.safeParse(book({ lotIds: [...twenty, LOT_B] })).success).toBe(
      false,
    );
  });

  it("needs a real instant with an offset", () => {
    for (const slotStart of ["tomorrow", "2026-11-12", "2026-11-12T14:00:00", ""]) {
      expect(bookCollectionBodySchema.safeParse(book({ slotStart })).success).toBe(false);
    }
  });

  it("needs a key of 8 to 128 letters, digits, - or _", () => {
    for (const idempotencyKey of ["short", "has space 123", "x".repeat(129), ""]) {
      expect(bookCollectionBodySchema.safeParse(book({ idempotencyKey })).success).toBe(false);
    }
    expect(
      bookCollectionBodySchema.safeParse(book({ idempotencyKey: "a".repeat(128) })).success,
    ).toBe(true);
    expect(bookCollectionBodySchema.safeParse(book({ idempotencyKey: undefined })).success).toBe(
      false,
    );
  });

  it("takes the name as it is on the ID, trimmed, and a third party's optional details", () => {
    const parsed = bookCollectionBodySchema.parse(
      book({
        collector: {
          kind: "third_party",
          name: "  Sam Okoro ",
          email: "sam@example.com",
          company: null,
          authorised: true,
        },
      }),
    );
    expect(parsed.collector).toMatchObject({ name: "Sam Okoro", authorised: true, company: null });
    expect(
      bookCollectionBodySchema.safeParse(book({ collector: { kind: "self", name: "A" } })).success,
    ).toBe(false);
    expect(
      bookCollectionBodySchema.safeParse(
        book({ collector: { kind: "stranger", name: "Sam Okoro" } }),
      ).success,
    ).toBe(false);
  });

  it("refuses fields it does not know, so nothing slips in a request", () => {
    expect(bookCollectionBodySchema.safeParse(book({ overCapacityReason: "phoned" })).success).toBe(
      false,
    );
    expect(bookCollectionBodySchema.safeParse(book({ bookedVia: "staff" })).success).toBe(false);
    expect(
      bookCollectionBodySchema.safeParse(book({ collector: { ...collector, userId: "someone" } }))
        .success,
    ).toBe(false);
  });
});

describe("changeCollectionBodySchema and cancelCollectionBodySchema", () => {
  it("carry the version the person read", () => {
    expect(
      changeCollectionBodySchema.safeParse({
        version: 2,
        lotIds: [LOT_A],
        slotStart: "2026-11-12T14:30:00Z",
        collector,
      }).success,
    ).toBe(true);
    expect(cancelCollectionBodySchema.safeParse({ version: 0 }).success).toBe(true);
    expect(cancelCollectionBodySchema.safeParse({}).success).toBe(false);
    expect(cancelCollectionBodySchema.safeParse({ version: -1 }).success).toBe(false);
    expect(cancelCollectionBodySchema.safeParse({ version: 1.5 }).success).toBe(false);
  });
});

describe("collectionAvailabilityQuerySchema", () => {
  it("splits the lots, and allows none yet", () => {
    expect(collectionAvailabilityQuerySchema.parse({ lots: `${LOT_A}, ${LOT_B}` }).lots).toEqual([
      LOT_A,
      LOT_B,
    ]);
    expect(collectionAvailabilityQuerySchema.parse({}).lots).toEqual([]);
    expect(collectionAvailabilityQuerySchema.safeParse({ lots: "nope" }).success).toBe(false);
  });

  it("takes the booking being moved", () => {
    expect(collectionAvailabilityQuerySchema.parse({ lots: LOT_A, booking: LOT_B }).booking).toBe(
      LOT_B,
    );
    expect(collectionAvailabilityQuerySchema.safeParse({ booking: "x" }).success).toBe(false);
  });
});

describe("handOverCollectionBodySchema", () => {
  it("requires the kind of photo ID checked", () => {
    expect(handOverCollectionBodySchema.safeParse({ lotIds: [LOT_A] }).success).toBe(false);
    expect(handOverCollectionBodySchema.safeParse({ lotIds: [LOT_A], idCheck: {} }).success).toBe(
      false,
    );
    expect(
      handOverCollectionBodySchema.safeParse({ lotIds: [LOT_A], idCheck: { type: "library_card" } })
        .success,
    ).toBe(false);
    for (const type of [
      "passport",
      "driving_licence",
      "national_identity_card",
      "other_photo_id",
    ]) {
      expect(
        handOverCollectionBodySchema.safeParse({ lotIds: [LOT_A], idCheck: { type } }).success,
      ).toBe(true);
    }
  });

  it("never takes the number or a copy of the ID", () => {
    expect(
      handOverCollectionBodySchema.safeParse({
        lotIds: [LOT_A],
        idCheck: { type: "passport", number: "123456789" },
      }).success,
    ).toBe(true); // unknown keys inside idCheck are dropped, not stored
    const parsed = handOverCollectionBodySchema.parse({
      lotIds: [LOT_A],
      idCheck: { type: "passport", number: "123456789" },
    });
    expect(JSON.stringify(parsed)).not.toContain("123456789");
    expect(
      handOverCollectionBodySchema.safeParse({
        lotIds: [LOT_A],
        idCheck: { type: "passport" },
        idNumber: "123456789",
      }).success,
    ).toBe(false);
  });
});

describe("collectionBookingIdParamSchema", () => {
  it("is a UUID", () => {
    expect(collectionBookingIdParamSchema.safeParse({ bookingId: LOT_A }).success).toBe(true);
    expect(collectionBookingIdParamSchema.safeParse({ bookingId: "COL-1001" }).success).toBe(false);
  });
});
