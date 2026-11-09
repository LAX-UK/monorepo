import { describe, expect, it } from "vitest";
import {
  bodyFromDraft,
  draftFromSettings,
  emptyExceptionDraft,
  exceptionBody,
  isDirty,
  validateExceptionDraft,
  validateSettingsDraft,
} from "./collection-forms";
import { SETTINGS } from "./collections.fixture";

describe("the settings form", () => {
  it("starts from what is saved, and is not dirty until something changes", () => {
    const draft = draftFromSettings(SETTINGS);
    expect(draft.visitMinutes).toBe("30");
    expect(draft.freeStorageDays).toBe("");
    expect(draft.hours).toHaveLength(5);
    expect(isDirty(draft, SETTINGS)).toBe(false);
    expect(isDirty({ ...draft, visitMinutes: "45" }, SETTINGS)).toBe(true);
    expect(isDirty({ ...draft, hours: draft.hours.slice(1) }, SETTINGS)).toBe(true);
  });

  it("sends numbers as numbers, empty storage as no limit, and the version it was loaded at", () => {
    const body = bodyFromDraft(
      { ...draftFromSettings(SETTINGS), freeStorageDays: " 14 ", bookingEmail: "  " },
      SETTINGS.version,
    );
    expect(body).toMatchObject({
      version: SETTINGS.version,
      visitMinutes: 30,
      freeStorageDays: 14,
      bookingEmail: null,
    });
    expect(bodyFromDraft(draftFromSettings(SETTINGS), "v").freeStorageDays).toBeNull();
  });

  it("accepts the settings as they stand", () => {
    expect(validateSettingsDraft(draftFromSettings(SETTINGS)).count).toBe(0);
  });

  it("reads the storage charge as pounds and sends pence, empty meaning none", () => {
    expect(draftFromSettings(SETTINGS).storageChargePounds).toBe("");
    expect(draftFromSettings({ ...SETTINGS, storageChargePence: 2500 }).storageChargePounds).toBe(
      "25",
    );
    expect(draftFromSettings({ ...SETTINGS, storageChargePence: 1250 }).storageChargePounds).toBe(
      "12.50",
    );
    expect(draftFromSettings({ ...SETTINGS, storageChargePence: 5 }).storageChargePounds).toBe(
      "0.05",
    );
    const draft = (text: string) => ({ ...draftFromSettings(SETTINGS), storageChargePounds: text });
    expect(bodyFromDraft(draft(" 25 "), "v").storageChargePence).toBe(2500);
    expect(bodyFromDraft(draft("12.5"), "v").storageChargePence).toBe(1250);
    expect(bodyFromDraft(draft("0.05"), "v").storageChargePence).toBe(5);
    expect(bodyFromDraft(draft(""), "v").storageChargePence).toBeNull();
  });

  it("says when the storage charge is not an amount", () => {
    for (const text of ["abc", "12.345", "-5", "1,000", "99999"]) {
      const { rules } = validateSettingsDraft({
        ...draftFromSettings(SETTINGS),
        storageChargePounds: text,
      });
      expect(rules.storage_charge).toBe(
        "Enter an amount in pounds, such as 25 or 12.50, or leave it empty.",
      );
    }
    expect(
      validateSettingsDraft({ ...draftFromSettings(SETTINGS), storageChargePounds: "25" }).count,
    ).toBe(0);
  });

  it("says which rule fields are wrong", () => {
    const draft = {
      ...draftFromSettings(SETTINGS),
      visitMinutes: "25",
      placesPerSlot: "many",
      noticeCutoffLocal: "4pm",
      windowDays: "3",
      maxActiveVisits: "0",
      freeStorageDays: "400",
      bookingEmail: "not an email",
    };
    const { rules, count } = validateSettingsDraft(draft);
    expect(Object.keys(rules).sort()).toEqual([
      "booking_email",
      "free_storage_days",
      "max_active_visits",
      "notice_cutoff",
      "places_per_slot",
      "visit_minutes",
      "window_days",
    ]);
    expect(rules.visit_minutes).toBe("Choose one of the visit lengths.");
    expect(count).toBe(7);
  });

  it("marks the opening-hours row at fault, not the day", () => {
    const draft = draftFromSettings(SETTINGS);
    const monday = draft.hours.filter((r) => r.weekday === 1);
    const extra = { key: "added-1", weekday: 1, opensLocal: "12:00", closesLocal: "15:00" };
    const errors = validateSettingsDraft({
      ...draft,
      hours: [...draft.hours.filter((r) => r.weekday !== 1), ...monday, extra],
    });
    expect(errors.hours).toEqual({ "added-1": "overlap" });
    const reversed = validateSettingsDraft({
      ...draft,
      hours: draft.hours.map((r, i) => (i === 2 ? { ...r, opensLocal: "20:00" } : r)),
    });
    expect(Object.values(reversed.hours)).toEqual(["closes_not_after_opens"]);
  });
});

describe("the closure form", () => {
  const today = "2026-11-09";

  it("starts as a whole-day closure today", () => {
    expect(emptyExceptionDraft(today)).toMatchObject({
      kind: "closure",
      startsOn: today,
      endsOn: today,
      partDay: false,
    });
  });

  it("sends times only for part of a day, and an empty note as none", () => {
    const draft = { ...emptyExceptionDraft(today), opensLocal: "13:00", closesLocal: "14:00" };
    expect(exceptionBody(draft)).toMatchObject({
      opensLocal: null,
      closesLocal: null,
      reason: null,
    });
    expect(exceptionBody({ ...draft, partDay: true, reason: " Staff party " })).toMatchObject({
      opensLocal: "13:00",
      closesLocal: "14:00",
      reason: "Staff party",
    });
  });

  it("names what is wrong, and refuses a day already gone", () => {
    const base = emptyExceptionDraft(today);
    expect(validateExceptionDraft(base, today)).toEqual([]);
    expect(validateExceptionDraft({ ...base, endsOn: "2026-11-08" }, today)).toEqual([
      "ends_before_start",
    ]);
    expect(validateExceptionDraft({ ...base, partDay: true }, today)).toEqual(["time_invalid"]);
    expect(
      validateExceptionDraft({ ...base, startsOn: "2026-11-01", endsOn: "2026-11-02" }, today),
    ).toEqual(["date_invalid"]);
    expect(validateExceptionDraft({ ...base, startsOn: "" }, today)).toContain("date_invalid");
  });
});
