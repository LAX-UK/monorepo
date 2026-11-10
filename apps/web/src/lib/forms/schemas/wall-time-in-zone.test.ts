import { describe, expect, it } from "vitest";
import { missingWallTimeMessage } from "./wall-time-in-zone";

describe("missingWallTimeMessage", () => {
  it("names the skipped hour and the first time that works", () => {
    expect(missingWallTimeMessage("2026-03-29T01:30", "Europe/London")).toBe(
      "That time doesn't exist on 29 Mar because the clocks go forward. Choose 02:00 or later.",
    );
  });

  it("follows the sale's zone", () => {
    expect(missingWallTimeMessage("2026-03-29T01:30", "Europe/Paris")).toBeNull();
    expect(missingWallTimeMessage("2026-03-29T02:30", "Europe/Paris")).toContain("Choose 03:00");
  });

  it("is silent for a time that exists, a repeated hour and unreadable text", () => {
    expect(missingWallTimeMessage("2026-03-29T02:00", "Europe/London")).toBeNull();
    expect(missingWallTimeMessage("2026-10-25T01:30", "Europe/London")).toBeNull();
    expect(missingWallTimeMessage("", "Europe/London")).toBeNull();
    expect(missingWallTimeMessage("tomorrow", "Europe/London")).toBeNull();
  });
});
