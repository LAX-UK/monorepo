import { describe, expect, it } from "vitest";
import { windowsZoneId } from "./windows-zone.js";
import { listZoneChoices } from "./zone-choices.js";

describe("windowsZoneId", () => {
  it.each([
    ["Europe/London", "GMT Standard Time"],
    ["Europe/Paris", "Romance Standard Time"],
    ["America/New_York", "Eastern Standard Time"],
    ["Asia/Dubai", "Arabian Standard Time"],
    ["Asia/Kolkata", "India Standard Time"],
    ["Australia/Lord_Howe", "Lord Howe Standard Time"],
  ])("maps %s to %s", (zone, windows) => {
    expect(windowsZoneId(zone)).toBe(windows);
  });

  it("has nothing for a name it does not know, including inherited object keys", () => {
    expect(windowsZoneId("Nowhere/Land")).toBeNull();
    expect(windowsZoneId("constructor")).toBeNull();
  });

  it("covers almost every zone staff can choose", () => {
    const choices = listZoneChoices(new Date("2026-11-12T12:00:00Z"));
    const unmapped = choices.filter((choice) => windowsZoneId(choice.zone) === null);
    expect(unmapped.length / choices.length).toBeLessThan(0.1);
  });
});
