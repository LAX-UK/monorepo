import { expireStalePaymentsWithPorts } from "@auction/finance-cron-app";
import { describe, expect, it, vi } from "vitest";

describe("api/worker expire stale payments parity", () => {
  it("uses the same port contract for stale pending and authorized rows", async () => {
    const ports = {
      listStalePendingBefore: vi.fn().mockResolvedValue([]),
      listStaleAuthorizedBefore: vi.fn().mockResolvedValue([]),
      cancelPayment: vi.fn(),
      publishPaymentCancelled: vi.fn(),
    };

    await expireStalePaymentsWithPorts(ports, 14, 30);

    expect(ports.listStalePendingBefore).toHaveBeenCalledTimes(1);
    expect(ports.listStaleAuthorizedBefore).toHaveBeenCalledTimes(1);
    const pendingCutoff = ports.listStalePendingBefore.mock.calls[0]?.[0] as Date;
    const authorizedCutoff = ports.listStaleAuthorizedBefore.mock.calls[0]?.[0] as Date;
    expect(pendingCutoff).toBeDefined();
    expect(authorizedCutoff).toBeDefined();
    expect(pendingCutoff.getTime()).toBeLessThan(Date.now());
    expect(authorizedCutoff.getTime()).toBeLessThan(pendingCutoff.getTime());
  });
});
