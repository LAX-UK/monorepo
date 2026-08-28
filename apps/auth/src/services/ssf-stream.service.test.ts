import { SSF_EVENT_TYPES } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { SsfStreamService } from "./ssf-stream.service.js";
import type { SsfStreamRecord, SsfStreamRepository } from "./ssf.ports.js";

function stream(status: SsfStreamRecord["status"]): SsfStreamRecord {
  return {
    id: "stream-1",
    clientId: "lax-bid",
    audience: "lax-bid-api",
    endpoint: "https://api.test/ssf/events",
    status,
    eventsRequested: [SSF_EVENT_TYPES.ACCOUNT_DISABLED],
    eventsDelivered: [SSF_EVENT_TYPES.ACCOUNT_DISABLED],
    lastMappedEventId: 7,
    signingKid: null,
  };
}

function createService(status: SsfStreamRecord["status"]) {
  const currentDomainEventId = vi.fn().mockResolvedValue(42);
  const setStatus = vi.fn().mockResolvedValue(true);
  const streams = {
    read: vi.fn().mockResolvedValue([stream(status)]),
    currentDomainEventId,
    setStatus,
  } as unknown as SsfStreamRepository;
  const service = new SsfStreamService(
    streams,
    {} as never,
    {} as never,
    "https://auth.test",
    "test",
    () => new Date("2026-08-28T20:00:00.000Z"),
  );
  return { service, currentDomainEventId, setStatus };
}

describe("SsfStreamService.setStatus checkpoint semantics", () => {
  it("intentionally resets to current outbox position when enabling a disabled stream", async () => {
    const { service, currentDomainEventId, setStatus } = createService("disabled");

    await expect(service.setStatus("lax-bid", "stream-1", "enabled")).resolves.toBe(true);

    expect(currentDomainEventId).toHaveBeenCalledOnce();
    expect(setStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "lax-bid",
        streamId: "stream-1",
        status: "enabled",
        resetCheckpoint: 42,
      }),
    );
  });

  it.each(["enabled", "paused"] as const)(
    "preserves the checkpoint when transitioning from %s to enabled",
    async (existingStatus) => {
      const { service, currentDomainEventId, setStatus } = createService(existingStatus);

      await expect(service.setStatus("lax-bid", "stream-1", "enabled")).resolves.toBe(true);

      expect(currentDomainEventId).not.toHaveBeenCalled();
      expect(setStatus).toHaveBeenCalledWith(
        expect.not.objectContaining({ resetCheckpoint: expect.anything() }),
      );
    },
  );
});
