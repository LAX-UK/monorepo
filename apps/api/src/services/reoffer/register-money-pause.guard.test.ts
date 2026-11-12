import { MONEY_PAUSED_STAFF_MESSAGE } from "@auction/artwork-register-contracts";
import type { LotRegisterLink } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { RegisterMoneyPauseGuard } from "./register-money-pause.guard.js";
import { ReofferError } from "./reoffer-errors.js";

const context = { lotId: "lot-1", reofferId: "re-1" };
const link: LotRegisterLink = {
  registerId: "reg-1",
  status: "ended",
  hasWinner: false,
  soldOnAtg: false,
};

function guard(found: LotRegisterLink | null, paused: boolean) {
  const isPaused = vi.fn(async () => paused);
  const findLink = vi.fn(async () => found);
  return { guard: new RegisterMoneyPauseGuard({ findLink }, { isPaused }), isPaused, findLink };
}

describe("RegisterMoneyPauseGuard", () => {
  it.each(["reoffer_send", "reoffer_accept"] as const)(
    "refuses %s with money_paused and the staff wording when the artwork is paused",
    async (step) => {
      const { guard: g, isPaused } = guard(link, true);
      const error = await g.assertNotPaused(step, context).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ReofferError);
      expect(error).toMatchObject({
        code: "money_paused",
        status: 423,
        message: MONEY_PAUSED_STAFF_MESSAGE,
      });
      expect(isPaused).toHaveBeenCalledWith({ registerId: "reg-1" });
    },
  );

  it("allows the step when the artwork is not paused", async () => {
    const { guard: g } = guard(link, false);
    await expect(g.assertNotPaused("reoffer_send", context)).resolves.toBeUndefined();
  });

  it("does not govern a lot with no register link", async () => {
    const { guard: g, isPaused } = guard(null, true);
    await expect(g.assertNotPaused("reoffer_accept", context)).resolves.toBeUndefined();
    expect(isPaused).not.toHaveBeenCalled();
  });

  it("lets other failures through unchanged", async () => {
    const boom = new Error("db down");
    const g = new RegisterMoneyPauseGuard(
      { findLink: async () => link },
      {
        isPaused: async () => {
          throw boom;
        },
      },
    );
    await expect(g.assertNotPaused("reoffer_send", context)).rejects.toBe(boom);
  });
});
