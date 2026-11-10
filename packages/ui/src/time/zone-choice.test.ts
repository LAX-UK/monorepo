import { describe, expect, it } from "vitest";
import { canSaveZoneChoice, initialZoneChoice } from "./zone-choice.js";

const DEVICE = { zone: "Africa/Cairo", source: "device" } as const;
const CHOSEN = { zone: "America/New_York", source: "chosen" } as const;
const ACCOUNT = { zone: "America/New_York", source: "account" } as const;

describe("initialZoneChoice", () => {
  it("opens on Automatic for a device reading", () => {
    expect(initialZoneChoice(DEVICE)).toEqual({ mode: "automatic" });
  });

  it.each([CHOSEN, ACCOUNT])("opens on the saved city for a $source choice", (saved) => {
    expect(initialZoneChoice(saved)).toEqual({ mode: "fixed", zone: "America/New_York" });
  });
});

describe("canSaveZoneChoice", () => {
  it("is off while the choice is what is in use", () => {
    expect(canSaveZoneChoice({ mode: "automatic" }, DEVICE)).toBe(false);
    expect(canSaveZoneChoice({ mode: "fixed", zone: "America/New_York" }, CHOSEN)).toBe(false);
    expect(canSaveZoneChoice({ mode: "fixed", zone: "America/New_York" }, ACCOUNT)).toBe(false);
  });

  it("is off for Always use with no city yet", () => {
    expect(canSaveZoneChoice({ mode: "fixed", zone: null }, DEVICE)).toBe(false);
  });

  it("is on for a different city, for pinning the device's own city, and for going back to Automatic", () => {
    expect(canSaveZoneChoice({ mode: "fixed", zone: "Asia/Tokyo" }, CHOSEN)).toBe(true);
    expect(canSaveZoneChoice({ mode: "fixed", zone: "Africa/Cairo" }, DEVICE)).toBe(true);
    expect(canSaveZoneChoice({ mode: "automatic" }, CHOSEN)).toBe(true);
    expect(canSaveZoneChoice({ mode: "automatic" }, ACCOUNT)).toBe(true);
  });
});
