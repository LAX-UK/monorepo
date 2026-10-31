import { describe, expect, it } from "vitest";
import { inboxTime } from "./inbox-time";

const NOW = new Date(2026, 9, 31, 16, 0);

describe("inboxTime", () => {
  it("shows the time today and yesterday, where the day heading names the day", () => {
    expect(inboxTime(new Date(2026, 9, 31, 14, 2), NOW)).toBe("14:02");
    expect(inboxTime(new Date(2026, 9, 30, 9, 5), NOW)).toBe("09:05");
  });

  it("shows the date for anything older", () => {
    expect(inboxTime(new Date(2026, 9, 29, 9, 0), NOW)).toBe("29 Oct");
  });
});
