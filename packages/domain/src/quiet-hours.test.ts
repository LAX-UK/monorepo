import { describe, expect, it } from "vitest";
import { isValidTimeZone, isWithinQuietHours } from "./quiet-hours.js";

const LONDON = { start: "22:00", end: "07:00", timeZone: "Europe/London" };
const at = (iso: string) => new Date(iso);

describe("quiet hours in the person's own zone", () => {
  it("holds 22:00–07:00 London in winter (GMT)", () => {
    expect(isWithinQuietHours(LONDON, at("2026-12-01T21:59:00Z"))).toBe(false);
    expect(isWithinQuietHours(LONDON, at("2026-12-01T22:00:00Z"))).toBe(true);
    expect(isWithinQuietHours(LONDON, at("2026-12-02T06:59:00Z"))).toBe(true);
    expect(isWithinQuietHours(LONDON, at("2026-12-02T07:00:00Z"))).toBe(false);
  });

  it("holds 22:00–07:00 London in summer (BST), an hour earlier in UTC", () => {
    expect(isWithinQuietHours(LONDON, at("2026-07-01T20:59:00Z"))).toBe(false);
    expect(isWithinQuietHours(LONDON, at("2026-07-01T21:00:00Z"))).toBe(true);
    expect(isWithinQuietHours(LONDON, at("2026-07-02T05:59:00Z"))).toBe(true);
    expect(isWithinQuietHours(LONDON, at("2026-07-02T06:00:00Z"))).toBe(false);
  });

  it("keeps local times across the spring change (clocks forward, 29 Mar 2026)", () => {
    // Saturday night is GMT: 22:00 local is 22:00 UTC.
    expect(isWithinQuietHours(LONDON, at("2026-03-28T22:00:00Z"))).toBe(true);
    // Sunday morning is BST: 07:00 local is 06:00 UTC, so 06:30 UTC is no longer quiet.
    expect(isWithinQuietHours(LONDON, at("2026-03-29T05:59:00Z"))).toBe(true);
    expect(isWithinQuietHours(LONDON, at("2026-03-29T06:30:00Z"))).toBe(false);
  });

  it("keeps local times across the autumn change (clocks back, 25 Oct 2026)", () => {
    // Saturday night is BST: 22:00 local is 21:00 UTC.
    expect(isWithinQuietHours(LONDON, at("2026-10-24T21:00:00Z"))).toBe(true);
    // Sunday morning is GMT: 07:00 local is 07:00 UTC, so 06:30 UTC is still quiet.
    expect(isWithinQuietHours(LONDON, at("2026-10-25T06:30:00Z"))).toBe(true);
    expect(isWithinQuietHours(LONDON, at("2026-10-25T07:00:00Z"))).toBe(false);
  });

  it("reads another zone in its own time", () => {
    const ny = { start: "23:00", end: "06:00", timeZone: "America/New_York" };
    expect(isWithinQuietHours(ny, at("2026-12-02T04:30:00Z"))).toBe(true);
    expect(isWithinQuietHours(ny, at("2026-12-02T12:00:00Z"))).toBe(false);
  });

  it("is never quiet when unset, malformed or empty; an unknown zone reads as London", () => {
    expect(isWithinQuietHours({ ...LONDON, start: null }, at("2026-12-01T23:00:00Z"))).toBe(false);
    expect(isWithinQuietHours({ ...LONDON, end: "7am" }, at("2026-12-01T23:00:00Z"))).toBe(false);
    expect(isWithinQuietHours({ ...LONDON, end: "22:00" }, at("2026-12-01T23:00:00Z"))).toBe(false);
    expect(
      isWithinQuietHours({ ...LONDON, timeZone: "Mars/Olympus" }, at("2026-07-01T21:30:00Z")),
    ).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
