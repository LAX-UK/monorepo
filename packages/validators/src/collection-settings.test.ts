import { describe, expect, it } from "vitest";
import { saveCollectionSettingsBodySchema } from "./collection-settings.js";

const BODY = {
  version: "2031-03-10T12:00:00.000Z",
  onlineBookingEnabled: true,
  visitMinutes: 30,
  placesPerSlot: 2,
  noticeCutoffLocal: "16:00",
  noticeWorkingDays: 1,
  windowDays: 28,
  closeOnSaleDays: true,
  undoHandOverMinutes: 10,
  maxActiveVisits: 5,
  freeStorageDays: 14,
  bookingEmail: null,
  hours: [],
};

describe("saveCollectionSettingsBodySchema", () => {
  it("accepts a save without the dropped weekly charge", () => {
    expect(saveCollectionSettingsBodySchema.safeParse(BODY).success).toBe(true);
  });

  it("still accepts a save from a web release that sends the dropped weekly charge", () => {
    expect(
      saveCollectionSettingsBodySchema.safeParse({ ...BODY, storageChargePence: 2500 }).success,
    ).toBe(true);
  });

  it("refuses other unknown fields", () => {
    expect(saveCollectionSettingsBodySchema.safeParse({ ...BODY, extra: 1 }).success).toBe(false);
  });
});
