import { describe, expect, it, vi } from "vitest";
import type { NotificationService } from "../notification.service.js";
import { ProxyAutoBidResolver } from "./proxy-auto-bid.resolver.js";

describe("ProxyAutoBidResolver", () => {
  it("logs proxy cancellation notification failures without aborting", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const notifyProxyCancelled = vi.fn().mockRejectedValue(new Error("push unavailable"));
    const notifications = { notifyProxyCancelled } as unknown as NotificationService;
    const resolver = new ProxyAutoBidResolver(null, notifications, null);

    await (
      resolver as unknown as {
        notifyProxyCancelledSafe: (
          lotId: string,
          bidderUserId: string,
          reason: string,
        ) => Promise<void>;
      }
    ).notifyProxyCancelledSafe("lot-1", "bidder-1", "anti_shilling_violation");

    expect(notifyProxyCancelled).toHaveBeenCalledWith(
      "lot-1",
      "bidder-1",
      "anti_shilling_violation",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[ProxyAutoBidResolver] notifyProxyCancelled failed",
      expect.objectContaining({ lotId: "lot-1", bidderUserId: "bidder-1" }),
    );
    errorSpy.mockRestore();
  });
});
