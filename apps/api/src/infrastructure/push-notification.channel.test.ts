import { describe, expect, it, vi } from "vitest";
import type { IPushSender } from "../services/interfaces/push.js";
import { PushNotificationChannel } from "./push-notification.channel.js";

const payload = {
  type: "outbid",
  title: "Outbid",
  message: "Another bidder is ahead",
  lotId: "lot-1",
  meta: { lotTitle: "Blue Period Study" },
};

function makeSubs() {
  return [
    { endpoint: "https://push.example/a", p256dh: "k1", auth: "a1" },
    { endpoint: "https://push.example/b", p256dh: "k2", auth: "a2" },
  ];
}

describe("PushNotificationChannel", () => {
  it("continues sending to remaining subscriptions when one send throws", async () => {
    const send = vi
      .fn<IPushSender["send"]>()
      .mockRejectedValueOnce(new Error("upstream 503"))
      .mockResolvedValueOnce(true);
    const deleteByEndpoint = vi.fn();
    const channel = new PushNotificationChannel(
      { send },
      {
        findByUser: vi.fn().mockResolvedValue(makeSubs()),
        create: vi.fn(),
        deleteByEndpoint,
      },
    );

    await channel.send("user-1", payload);

    expect(send).toHaveBeenCalledTimes(2);
    expect(deleteByEndpoint).not.toHaveBeenCalled();
  });

  it("deletes stale endpoints and still delivers to the rest", async () => {
    const send = vi
      .fn<IPushSender["send"]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const deleteByEndpoint = vi.fn().mockResolvedValue(undefined);
    const channel = new PushNotificationChannel(
      { send },
      {
        findByUser: vi.fn().mockResolvedValue(makeSubs()),
        create: vi.fn(),
        deleteByEndpoint,
      },
    );

    await channel.send("user-1", payload);

    expect(deleteByEndpoint).toHaveBeenCalledWith("https://push.example/a");
    expect(send).toHaveBeenCalledTimes(2);
  });
});
