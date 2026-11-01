import { describe, expect, it } from "vitest";
import { watchlistReminderBodySchema } from "./watchlist.js";

describe("watchlistReminderBodySchema", () => {
  it("takes a reminder time and a trimmed note, empty meaning none", () => {
    expect(
      watchlistReminderBodySchema.parse({ kind: "hour_before_close", note: " Check the frame " }),
    ).toEqual({ kind: "hour_before_close", note: "Check the frame" });
    expect(watchlistReminderBodySchema.parse({ kind: "sale_start", note: "  " })).toEqual({
      kind: "sale_start",
      note: null,
    });
    expect(watchlistReminderBodySchema.parse({ kind: "day_before_close" }).note).toBeNull();
  });

  it("refuses an unknown time, a long note or extra fields", () => {
    expect(watchlistReminderBodySchema.safeParse({ kind: "tomorrow" }).success).toBe(false);
    expect(
      watchlistReminderBodySchema.safeParse({ kind: "sale_start", note: "x".repeat(501) }).success,
    ).toBe(false);
    expect(
      watchlistReminderBodySchema.safeParse({ kind: "sale_start", at: "2026-11-01" }).success,
    ).toBe(false);
  });
});
