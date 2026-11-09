import { describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTION_RULES,
  DEFAULT_COLLECTION_WEEKLY_HOURS,
  collectionRulesIssues,
} from "./collection-rules.js";

const rules = (over: Partial<typeof DEFAULT_COLLECTION_RULES>) => ({
  ...DEFAULT_COLLECTION_RULES,
  ...over,
});

describe("collection rules", () => {
  it("defaults to the gallery: 30-minute visits, two at a time, 16:00 the day before, 4 weeks", () => {
    expect(DEFAULT_COLLECTION_RULES).toEqual({
      visitMinutes: 30,
      placesPerSlot: 2,
      noticeCutoffLocal: "16:00",
      noticeWorkingDays: 1,
      windowDays: 28,
      closeOnSaleDays: true,
      undoHandOverMinutes: 10,
    });
    expect(collectionRulesIssues(DEFAULT_COLLECTION_RULES)).toEqual([]);
  });

  it("opens Monday to Friday, 10:00 to 19:00, until staff change the hours", () => {
    expect(DEFAULT_COLLECTION_WEEKLY_HOURS.map((h) => h.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(
      DEFAULT_COLLECTION_WEEKLY_HOURS.every(
        (h) => h.opensLocal === "10:00" && h.closesLocal === "19:00",
      ),
    ).toBe(true);
  });

  it("accepts the visit lengths and place counts staff can choose", () => {
    for (const visitMinutes of [15, 20, 30, 45, 60]) {
      expect(collectionRulesIssues(rules({ visitMinutes }))).toEqual([]);
    }
    for (const placesPerSlot of [1, 10]) {
      expect(collectionRulesIssues(rules({ placesPerSlot }))).toEqual([]);
    }
  });

  it("names each field that is out of range", () => {
    expect(collectionRulesIssues(rules({ visitMinutes: 25 }))).toEqual(["visit_minutes"]);
    expect(collectionRulesIssues(rules({ placesPerSlot: 0 }))).toEqual(["places_per_slot"]);
    expect(collectionRulesIssues(rules({ placesPerSlot: 11 }))).toEqual(["places_per_slot"]);
    expect(collectionRulesIssues(rules({ placesPerSlot: 1.5 }))).toEqual(["places_per_slot"]);
    expect(collectionRulesIssues(rules({ noticeCutoffLocal: "4pm" }))).toEqual(["notice_cutoff"]);
    expect(collectionRulesIssues(rules({ noticeWorkingDays: 0 }))).toEqual(["notice_working_days"]);
    expect(collectionRulesIssues(rules({ noticeWorkingDays: 6 }))).toEqual(["notice_working_days"]);
    expect(collectionRulesIssues(rules({ windowDays: 3 }))).toEqual(["window_days"]);
    expect(collectionRulesIssues(rules({ windowDays: 91 }))).toEqual(["window_days"]);
    expect(collectionRulesIssues(rules({ undoHandOverMinutes: 0 }))).toEqual([
      "undo_hand_over_minutes",
    ]);
    expect(collectionRulesIssues(rules({ undoHandOverMinutes: 61 }))).toEqual([
      "undo_hand_over_minutes",
    ]);
    expect(collectionRulesIssues(rules({ undoHandOverMinutes: 60 }))).toEqual([]);
  });

  it("reports several issues together", () => {
    expect(collectionRulesIssues(rules({ visitMinutes: 7, windowDays: 1 }))).toEqual([
      "visit_minutes",
      "window_days",
    ]);
  });
});
