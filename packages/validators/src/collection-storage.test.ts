import { describe, expect, it } from "vitest";
import {
  cancelStorageTermsBodySchema,
  setStorageChargingBodySchema,
  storageTermsBodySchema,
  storageTermsParamSchema,
} from "./collection-storage.js";

const TERMS = {
  effectiveFrom: "2026-12-01",
  reason: "New rates for 2027",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 350,
  largeDailyPence: 700,
  handlingFeePence: 0,
};

const accepts = (over: Record<string, unknown>) =>
  storageTermsBodySchema.safeParse({ ...TERMS, ...over }).success;

describe("storage terms body", () => {
  it("accepts the terms staff schedule", () => {
    expect(storageTermsBodySchema.parse(TERMS)).toEqual(TERMS);
  });

  it("accepts the large band turned off, and the edges of every range", () => {
    expect(accepts({ largeDailyPence: null })).toBe(true);
    expect(accepts({ freeDays: 0, standardDailyPence: 0, handlingFeePence: 0 })).toBe(true);
    expect(accepts({ freeDays: 90, standardDailyPence: 50_000, largeDailyPence: 50_000 })).toBe(
      true,
    );
    expect(accepts({ handlingFeePence: 50_000, countMode: "working" })).toBe(true);
  });

  it.each([
    ["negative pence", { standardDailyPence: -1 }],
    ["fractional pence", { standardDailyPence: 350.5 }],
    ["pounds as a string", { standardDailyPence: "3.50" }],
    ["a rate over £500.00", { standardDailyPence: 50_001 }],
    ["a large rate over £500.00", { largeDailyPence: 50_001 }],
    ["a negative large rate", { largeDailyPence: -700 }],
    ["a large band of £0.00 (turn the band off instead)", { largeDailyPence: 0 }],
    ["a handling fee over £500.00", { handlingFeePence: 50_001 }],
    ["a fractional handling fee", { handlingFeePence: 0.5 }],
    ["negative free days", { freeDays: -1 }],
    ["free days over 90", { freeDays: 91 }],
    ["fractional free days", { freeDays: 14.5 }],
    ["an unknown count", { countMode: "weekly" }],
    ["a date that does not exist", { effectiveFrom: "2026-02-30" }],
    ["a date in another format", { effectiveFrom: "01/12/2026" }],
    ["an empty reason", { reason: "   " }],
    ["a reason over 500 characters", { reason: "x".repeat(501) }],
    ["an unknown field", { weeklyChargePence: 100 }],
  ])("refuses %s", (_label, over) => {
    expect(accepts(over)).toBe(false);
  });

  it("trims the reason", () => {
    expect(storageTermsBodySchema.parse({ ...TERMS, reason: "  Rates  " }).reason).toBe("Rates");
  });
});

describe("cancel and charging bodies", () => {
  it("need a reason", () => {
    expect(cancelStorageTermsBodySchema.safeParse({ reason: "Wrong date" }).success).toBe(true);
    expect(cancelStorageTermsBodySchema.safeParse({}).success).toBe(false);
    expect(
      setStorageChargingBodySchema.safeParse({ raiseInvoices: true, reason: "VAT agreed" }).success,
    ).toBe(true);
    expect(setStorageChargingBodySchema.safeParse({ raiseInvoices: true }).success).toBe(false);
    expect(
      setStorageChargingBodySchema.safeParse({ raiseInvoices: "yes", reason: "x" }).success,
    ).toBe(false);
  });

  it("take ids as uuids only", () => {
    expect(storageTermsParamSchema.safeParse({ venueId: "x", termsId: "y" }).success).toBe(false);
  });
});
