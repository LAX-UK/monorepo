import { emailHash } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { liftOptOutOnConfirm } from "./lift-opt-out-on-confirm.js";

describe("liftOptOutOnConfirm", () => {
  it("lifts the address's Campaigns opt-out at the time the person asked", async () => {
    const liftMarketingOptOut = vi.fn(async () => true);
    const at = new Date("2026-11-03T09:00:00Z");

    await liftOptOutOnConfirm(
      { liftMarketingOptOut },
      { warn: vi.fn() },
    )({
      subscriberId: "s1",
      product: "bid",
      email: "client@example.com",
      at,
    });

    expect(liftMarketingOptOut).toHaveBeenCalledWith(emailHash("client@example.com"), at);
  });

  it("logs a failed lift without the address and still rethrows", async () => {
    const warn = vi.fn();
    const liftMarketingOptOut = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(
      liftOptOutOnConfirm(
        { liftMarketingOptOut },
        { warn },
      )({
        subscriberId: "s1",
        product: "bid",
        email: "secret@example.com",
        at: new Date(),
      }),
    ).rejects.toThrow("db down");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret@example.com");
    expect(warn.mock.calls[0]?.[0]).toMatchObject({ subscriberId: "s1" });
  });

  it("lets a failure reach the caller, so a confirm retry finishes the lift", async () => {
    const liftMarketingOptOut = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(
      liftOptOutOnConfirm(
        { liftMarketingOptOut },
        { warn: vi.fn() },
      )({
        subscriberId: "s1",
        product: "bid",
        email: "a@example.com",
        at: new Date(),
      }),
    ).rejects.toThrow("db down");
  });
});
