import { describe, expect, it } from "vitest";
import {
  ArtworkMoneyPausedError,
  MONEY_PAUSED_BUYER_MESSAGE,
  MONEY_PAUSED_STAFF_MESSAGE,
  type MoneyPauseReader,
  assertMoneyNotPaused,
} from "./money-pause.js";

const reader = (paused: boolean): MoneyPauseReader => ({ isPaused: async () => paused });
const link = { zohoProductId: "z-1" };

describe("assertMoneyNotPaused", () => {
  it("lets an artwork that is not paused through", async () => {
    await expect(assertMoneyNotPaused(reader(false), link, "checkout")).resolves.toBeUndefined();
  });

  it("does not govern an artwork with no register link", async () => {
    await expect(assertMoneyNotPaused(reader(true), null, "checkout")).resolves.toBeUndefined();
  });

  it("refuses checkout with the calm buyer message", async () => {
    const error = await assertMoneyNotPaused(reader(true), link, "checkout").catch((e) => e);
    expect(error).toBeInstanceOf(ArtworkMoneyPausedError);
    expect(error.message).toBe(MONEY_PAUSED_BUYER_MESSAGE);
    expect(MONEY_PAUSED_BUYER_MESSAGE).toBe("This artwork is no longer available to buy online.");
  });

  it.each(["reoffer_send", "reoffer_accept"] as const)(
    "refuses %s with the staff message",
    async (action) => {
      const error = await assertMoneyNotPaused(reader(true), link, action).catch((e) => e);
      expect(error).toBeInstanceOf(ArtworkMoneyPausedError);
      expect(error.action).toBe(action);
      expect(error.message).toBe(MONEY_PAUSED_STAFF_MESSAGE);
    },
  );
});
