import { describe, expect, it } from "vitest";
import { createSaleSchema, updateSaleSchema } from "./create-update.js";
import {
  DEFAULT_SALE_TIME_ZONE,
  SALE_TIME_ZONE_INVALID,
  SALE_TIME_ZONE_NOT_A_PLACE,
  isValidSaleTimeZone,
  saleTimeZoneMessage,
  saleTimeZoneProblem,
  saleTimeZoneSchema,
} from "./time-zone.js";

const START = "2026-11-12T18:00:00.000Z";
const END = "2026-11-19T18:00:00.000Z";

describe("sale time zone", () => {
  it("defaults to London", () => {
    expect(DEFAULT_SALE_TIME_ZONE).toBe("Europe/London");
  });

  it.each(["Europe/London", "Europe/Paris", "America/New_York", "Asia/Kolkata", "Pacific/Chatham"])(
    "accepts the place zone %s",
    (zone) => {
      expect(isValidSaleTimeZone(zone)).toBe(true);
      expect(saleTimeZoneProblem(zone)).toBeNull();
    },
  );

  it.each(["UTC", "GMT", "Etc/UTC", "Etc/GMT+5"])("rejects the placeholder zone %s", (zone) => {
    expect(saleTimeZoneProblem(zone)).toBe("not_a_place");
    expect(isValidSaleTimeZone(zone)).toBe(false);
  });

  it.each(["", "London", "Mars/Olympus", "+01:00", "GMT+1", null, undefined, 5])(
    "rejects the unknown value %s",
    (zone) => {
      expect(saleTimeZoneProblem(zone)).toBe("unknown");
    },
  );

  it("words each problem for the person who typed it", () => {
    expect(saleTimeZoneMessage("unknown")).toBe(SALE_TIME_ZONE_INVALID);
    expect(saleTimeZoneMessage("not_a_place")).toBe(SALE_TIME_ZONE_NOT_A_PLACE);
  });

  it("reports the matching message from the schema", () => {
    const utc = saleTimeZoneSchema.safeParse("UTC");
    expect(utc.success).toBe(false);
    expect(utc.error?.issues[0]?.message).toBe(SALE_TIME_ZONE_NOT_A_PLACE);
    const nonsense = saleTimeZoneSchema.safeParse("Nowhere/Land");
    expect(nonsense.error?.issues[0]?.message).toBe(SALE_TIME_ZONE_INVALID);
  });
});

describe("sale create and update bodies", () => {
  const base = { title: "Autumn sale", startTime: START, endTime: END };

  it("leaves the zone out when none is given, for the column default to fill", () => {
    const parsed = createSaleSchema.parse(base) as { timeZone?: string };
    expect(parsed.timeZone).toBeUndefined();
  });

  it("keeps a valid zone on create and on update", () => {
    expect(createSaleSchema.parse({ ...base, timeZone: "Europe/Paris" })).toMatchObject({
      timeZone: "Europe/Paris",
    });
    expect(updateSaleSchema.parse({ timeZone: "Asia/Dubai" })).toMatchObject({
      timeZone: "Asia/Dubai",
    });
  });

  it("rejects UTC and unknown names on both", () => {
    expect(createSaleSchema.safeParse({ ...base, timeZone: "UTC" }).success).toBe(false);
    expect(createSaleSchema.safeParse({ ...base, timeZone: "Etc/GMT-3" }).success).toBe(false);
    expect(updateSaleSchema.safeParse({ timeZone: "Nowhere/Land" }).success).toBe(false);
  });
});
