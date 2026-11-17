import { describe, expect, it } from "vitest";
import {
  LOCATION_NAME_MAX,
  LOCATION_NOT_RECORDED,
  MOVE_NOTE_MAX,
  currentLocationLabel,
  locationLabel,
  locationNameKey,
  nextMoveTime,
  parseLocationName,
  parseLocationNote,
  parseMoveNote,
  planLocationMove,
} from "./stock-location.js";

describe("location names", () => {
  it("trims and collapses spaces", () => {
    expect(parseLocationName("  Gallery   main room ")).toEqual({
      ok: true,
      value: "Gallery main room",
    });
  });

  it("refuses a blank name and one over 80 characters", () => {
    expect(parseLocationName("   ")).toEqual({ ok: false, reason: "empty" });
    expect(parseLocationName("x".repeat(LOCATION_NAME_MAX)).ok).toBe(true);
    expect(parseLocationName("x".repeat(LOCATION_NAME_MAX + 1))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("counts characters as the database does, so accents and emoji are one each", () => {
    expect(parseLocationName("é".repeat(LOCATION_NAME_MAX)).ok).toBe(true);
    expect(parseLocationName("🖼".repeat(LOCATION_NAME_MAX)).ok).toBe(true);
  });

  it("compares names ignoring case and spacing", () => {
    expect(locationNameKey(" Store  ROOM")).toBe(locationNameKey("store room"));
  });
});

describe("notes", () => {
  it("treats a blank note as none", () => {
    expect(parseLocationNote("  ")).toEqual({ ok: true, value: null });
    expect(parseMoveNote(undefined)).toEqual({ ok: true, value: null });
    expect(parseMoveNote(null)).toEqual({ ok: true, value: null });
  });

  it("keeps a move note up to 500 characters and refuses a longer one", () => {
    expect(parseMoveNote(` ${"n".repeat(MOVE_NOTE_MAX)} `)).toEqual({
      ok: true,
      value: "n".repeat(MOVE_NOTE_MAX),
    });
    expect(parseMoveNote("n".repeat(MOVE_NOTE_MAX + 1))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("keeps a location note short", () => {
    expect(parseLocationNote("n".repeat(201))).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("how a location reads", () => {
  const room = { id: "l1", name: "Store room", status: "active" as const };

  it("reads Location not recorded when an artwork has never been moved", () => {
    expect(currentLocationLabel(null)).toBe(LOCATION_NOT_RECORDED);
  });

  it("names the current location, and marks one that has since been retired", () => {
    const at = new Date("2026-11-17T09:00:00Z");
    expect(currentLocationLabel({ location: room, movedAt: at, movedBy: "staff:s1" })).toBe(
      "Store room",
    );
    expect(locationLabel({ ...room, status: "retired" })).toBe("Store room (retired)");
  });
});

describe("planning a move", () => {
  it("refuses a location that does not exist or has been retired", () => {
    expect(planLocationMove({ target: null, currentLocationId: null })).toEqual({
      ok: false,
      reason: "location_not_found",
    });
    expect(
      planLocationMove({ target: { id: "l1", status: "retired" }, currentLocationId: null }),
    ).toEqual({ ok: false, reason: "location_retired" });
  });

  it("changes nothing when the artwork is already there", () => {
    expect(
      planLocationMove({ target: { id: "l1", status: "active" }, currentLocationId: "l1" }),
    ).toEqual({ ok: true, changes: false });
    expect(
      planLocationMove({ target: { id: "l1", status: "active" }, currentLocationId: "l2" }),
    ).toEqual({ ok: true, changes: true });
    expect(
      planLocationMove({ target: { id: "l1", status: "active" }, currentLocationId: null }),
    ).toEqual({ ok: true, changes: true });
  });
});

describe("move times", () => {
  const now = new Date("2026-11-17T09:00:00.000Z");

  it("uses now, or just after the previous move when the clock repeats or steps back", () => {
    expect(nextMoveTime(now, null)).toEqual(now);
    expect(nextMoveTime(now, new Date("2026-11-17T08:00:00.000Z"))).toEqual(now);
    expect(nextMoveTime(now, now)).toEqual(new Date("2026-11-17T09:00:00.001Z"));
    expect(nextMoveTime(now, new Date("2026-11-17T10:00:00.000Z"))).toEqual(
      new Date("2026-11-17T10:00:00.001Z"),
    );
  });
});
