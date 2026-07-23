import type {
  DomainEventDeliveryRow,
  IDomainEventDeliveryRepository,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { runDomainEventDelivery } from "./domain-event-delivery-runner.js";

function deliveryRow(overrides: Partial<DomainEventDeliveryRow> = {}): DomainEventDeliveryRow {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: 1,
    consumer: "zoho",
    eventId: 99,
    status: "processing",
    attempts: 1,
    leaseExpiresAt: now,
    nextRetryAt: null,
    idempotencyKey: "zoho:99",
    providerReference: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function mockRepo(): IDomainEventDeliveryRepository {
  return {
    claim: vi.fn(),
    renewLease: vi.fn().mockResolvedValue(true),
    markSucceeded: vi.fn().mockResolvedValue(undefined),
    scheduleRetry: vi.fn().mockResolvedValue(undefined),
    deadLetter: vi.fn().mockResolvedValue(undefined),
    ensurePending: vi.fn().mockResolvedValue(undefined),
    replay: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn(),
    listDeadLettered: vi.fn(),
  };
}

describe("runDomainEventDelivery", () => {
  it("marks success when deliver resolves", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow(),
      repo,
      leaseMs: 30_000,
      deliver: async () => ({ ok: true, providerReference: "crm-1" }),
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(repo.markSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 1, providerReference: "crm-1" }),
    );
  });

  it("dead-letters fatal errors", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow(),
      repo,
      leaseMs: 30_000,
      deliver: async () => {
        throw Object.assign(new Error("bad request"), { status: 400 });
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(repo.deadLetter).toHaveBeenCalled();
    expect(repo.scheduleRetry).not.toHaveBeenCalled();
  });

  it("schedules retry for retryable errors under max attempts", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 2 }),
      repo,
      leaseMs: 30_000,
      maxAttempts: 12,
      deliver: async () => {
        throw Object.assign(new Error("upstream"), { status: 503 });
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(repo.scheduleRetry).toHaveBeenCalled();
    expect(repo.deadLetter).not.toHaveBeenCalled();
  });
});
