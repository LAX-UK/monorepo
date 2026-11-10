import { describe, expect, it } from "vitest";
import { gmtOffsetLabel } from "./offset.js";

describe("gmtOffsetLabel", () => {
  const winter = new Date("2026-11-12T12:00:00Z");
  it.each([
    ["Europe/London", "GMT"],
    ["Australia/Sydney", "GMT+11"],
    ["America/New_York", "GMT−5"],
    ["Asia/Kolkata", "GMT+5:30"],
    ["Africa/Cairo", "GMT+2"],
  ])("writes %s as %s", (zone, label) => {
    expect(gmtOffsetLabel(winter, zone)).toBe(label);
  });
});
