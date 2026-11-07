import { emailHash } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { liftOptOutOnConfirm } from "./lift-opt-out-on-confirm.js";

describe("liftOptOutOnConfirm", () => {
  it("lifts the address's Campaigns opt-out at the time the person asked", async () => {
    const liftMarketingOptOut = vi.fn(async () => true);
    const at = new Date("2026-11-03T09:00:00Z");

    await liftOptOutOnConfirm({ liftMarketingOptOut })({
      subscriberId: "s1",
      product: "bid",
      email: "client@example.com",
      at,
    });

    expect(liftMarketingOptOut).toHaveBeenCalledWith(emailHash("client@example.com"), at);
  });

  it("lets a failure reach the caller, so a confirm retry finishes the lift", async () => {
    const liftMarketingOptOut = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(
      liftOptOutOnConfirm({ liftMarketingOptOut })({
        subscriberId: "s1",
        product: "bid",
        email: "a@example.com",
        at: new Date(),
      }),
    ).rejects.toThrow("db down");
  });
});
