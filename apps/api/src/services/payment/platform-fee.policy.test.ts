import { describe, expect, it, vi } from "vitest";
import { PlatformFeePolicy } from "./platform-fee.policy.js";

describe("PlatformFeePolicy", () => {
  it("uses entity platformFeeBps when set", async () => {
    const policy = new PlatformFeePolicy({
      findById: vi.fn().mockResolvedValue({ platformFeeBps: 450 }),
    } as never);
    await expect(policy.computePlatformFee("le1", 1000)).resolves.toBe("45.00");
  });

  it("defaults to 500 bps when entity has no override", async () => {
    const policy = new PlatformFeePolicy({
      findById: vi.fn().mockResolvedValue({ platformFeeBps: null }),
    } as never);
    await expect(policy.computePlatformFee("le1", 200)).resolves.toBe("10.00");
  });

  it("defaults when legal entity repository is omitted", async () => {
    const policy = new PlatformFeePolicy(null);
    await expect(policy.computePlatformFee("le1", 100)).resolves.toBe("5.00");
  });
});
