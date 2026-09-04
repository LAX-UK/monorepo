import { IDENTITY_EVENT_TYPES, SSF_EVENT_TYPES } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { SsfDeliveryWorker, createOrderedSsfJti } from "./ssf-delivery.worker.js";
import { SsfEventMapper } from "./ssf-event.mapper.js";
import type {
  SsfDeliveryRepository,
  SsfSourceEventReader,
  SsfStreamRecord,
  SsfStreamRepository,
} from "./ssf.ports.js";

const stream = (id: string): SsfStreamRecord => ({
  id,
  clientId: `${id}-client`,
  audience: `${id}-audience`,
  endpoint: `https://${id}.test/events`,
  status: "enabled",
  eventsRequested: [SSF_EVENT_TYPES.ACCOUNT_DISABLED],
  eventsDelivered: [SSF_EVENT_TYPES.ACCOUNT_DISABLED],
  lastMappedEventId: 0,
  signingKid: null,
});

function streamRepository(streams: SsfStreamRecord[], advanceCheckpoint = vi.fn()) {
  return {
    enabledStreams: async () => streams,
    advanceCheckpoint,
  } as unknown as SsfStreamRepository;
}

describe("SSF delivery worker", () => {
  it("fans one source event out to every subscribed stream and advances checkpoints", async () => {
    const sourceEvents = {
      readUnmapped: vi.fn().mockResolvedValue([
        {
          id: 7,
          eventType: IDENTITY_EVENT_TYPES.IDENTITY_DISABLED,
          aggregateId: "subject-1",
          payload: { subjectId: "subject-1" },
          correlationId: "txn-1",
          occurredAt: new Date("2026-08-13T06:00:00Z"),
        },
      ]),
    } satisfies SsfSourceEventReader;
    const enqueue = vi.fn().mockResolvedValue(true);
    const deliveries = {
      enqueue,
      recordSigningKid: vi.fn(),
      claimDue: vi.fn(),
      finalize: vi.fn(),
    } satisfies SsfDeliveryRepository;
    const checkpoints = vi.fn();
    const sign = vi.fn().mockResolvedValue({ token: "set.jwt", signingKid: "kid-1" });
    const worker = new SsfDeliveryWorker(
      streamRepository([stream("one"), stream("two")], checkpoints),
      sourceEvents,
      deliveries,
      new SsfEventMapper(),
      { sign },
      { dispatch: vi.fn() },
      "https://issuer.test",
      () => new Date("2026-08-13T06:00:00Z"),
    );

    await expect(worker.enqueueFromDomainEvents()).resolves.toBe(2);
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(checkpoints).toHaveBeenCalledTimes(2);
    for (const [input] of sign.mock.calls) {
      expect(input.jti).toMatch(/^lax-identity-outbox-v1\.[A-Za-z0-9_-]+\.7\.[0-9a-f-]+$/);
    }
  });

  it("rejects invalid source event ordering identifiers", () => {
    expect(() => createOrderedSsfJti("subject-1", 0)).toThrow("invalid_ssf_source_event_id");
    expect(() => createOrderedSsfJti("subject-1", Number.MAX_SAFE_INTEGER + 1)).toThrow(
      "invalid_ssf_source_event_id",
    );
  });

  it("claims, dispatches, and finalizes terminal retry exhaustion", async () => {
    const finalize = vi.fn();
    const deliveries = {
      enqueue: vi.fn(),
      recordSigningKid: vi.fn(),
      claimDue: vi.fn().mockResolvedValue([
        {
          id: "delivery-1",
          endpoint: "https://receiver.test/events",
          setToken: "set.jwt",
          attemptCount: 2,
        },
      ]),
      finalize,
    } satisfies SsfDeliveryRepository;
    const worker = new SsfDeliveryWorker(
      streamRepository([]),
      { readUnmapped: vi.fn() },
      deliveries,
      new SsfEventMapper(),
      { sign: vi.fn() },
      { dispatch: vi.fn().mockRejectedValue(new Error("offline")) },
      "https://issuer.test",
      () => new Date("2026-08-13T06:00:00Z"),
    );

    await expect(worker.deliverDue({ maxAttempts: 3 })).resolves.toBe(1);
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({ id: "delivery-1", status: "failed", attemptCount: 3 }),
    );
  });

  it.each([
    [204, "delivered", null],
    [503, "pending", null],
  ] as const)("finalizes HTTP %i as %s", async (statusCode, status, errorMessage) => {
    const finalize = vi.fn();
    const deliveries = {
      enqueue: vi.fn(),
      recordSigningKid: vi.fn(),
      claimDue: vi.fn().mockResolvedValue([
        {
          id: "delivery-1",
          endpoint: "https://receiver.test/events",
          setToken: "set.jwt",
          attemptCount: 0,
        },
      ]),
      finalize,
    } satisfies SsfDeliveryRepository;
    const worker = new SsfDeliveryWorker(
      streamRepository([]),
      { readUnmapped: vi.fn() },
      deliveries,
      new SsfEventMapper(),
      { sign: vi.fn() },
      { dispatch: vi.fn().mockResolvedValue({ status: statusCode }) },
      "https://issuer.test",
      () => new Date("2026-08-13T06:00:00Z"),
    );

    await worker.deliverDue();

    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "delivery-1",
        status,
        attemptCount: 1,
        statusCode,
        errorMessage,
      }),
    );
  });
});
