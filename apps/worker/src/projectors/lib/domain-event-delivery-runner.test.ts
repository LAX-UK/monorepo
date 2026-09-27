import type {
  DomainEventDeliveryRow,
  IDomainEventDeliveryRepository,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  claimAndRunDomainEventDeliveriesWithBudget,
  runDomainEventDelivery,
} from "./domain-event-delivery-runner.js";

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
    markSkipped: vi.fn().mockResolvedValue(undefined),
    replaySkippedForEventTypes: vi.fn().mockResolvedValue(0),
    scheduleRetry: vi.fn().mockResolvedValue(undefined),
    deadLetter: vi.fn().mockResolvedValue(undefined),
    ensurePending: vi.fn().mockResolvedValue(undefined),
    replay: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn(),
    listDeadLettered: vi.fn(),
    oldestPendingAt: vi.fn().mockResolvedValue(null),
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

  it("marks skipped when deliver returns skipped outcome", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow(),
      repo,
      leaseMs: 30_000,
      deliver: async () => ({ skipped: true, reason: "dry_run" }),
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(repo.markSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 1, reason: "dry_run" }),
    );
    expect(repo.markSucceeded).not.toHaveBeenCalled();
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

  it("retries when error carries retryable flag", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 1 }),
      repo,
      leaseMs: 30_000,
      deliver: async () => {
        throw Object.assign(new Error("person_not_linked"), { retryable: true });
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(repo.scheduleRetry).toHaveBeenCalled();
  });

  it("schedules retry at least Retry-After ms out for 429", async () => {
    const repo = mockRepo();
    const now = new Date("2026-01-01T00:00:00Z");
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 2 }),
      repo,
      leaseMs: 30_000,
      deliver: async () => {
        throw Object.assign(new Error("rate limited"), { status: 429, retryAfterMs: 120_000 });
      },
      now,
    });
    const call = vi.mocked(repo.scheduleRetry).mock.calls[0]?.[0];
    expect(call?.nextRetryAt).toBeDefined();
    const delayMs = (call?.nextRetryAt.getTime() ?? 0) - now.getTime();
    expect(delayMs).toBeGreaterThanOrEqual(120_000);
  });

  it("undoes attempt increment for circuit-open errors", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 11 }),
      repo,
      leaseMs: 30_000,
      maxAttempts: 12,
      deliver: async () => {
        throw Object.assign(new Error("zoho_crm_circuit_open"), {
          status: 503,
          retryable: true,
          retryAfterMs: 60_000,
        });
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(repo.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ undoAttemptIncrement: true }),
    );
    expect(repo.deadLetter).not.toHaveBeenCalled();
  });
});

describe("claimAndRunDomainEventDeliveriesWithBudget", () => {
  it("processes multiple deliveries within the time budget", async () => {
    const repo = mockRepo();
    let claimCalls = 0;
    repo.claim = vi.fn().mockImplementation(async () => {
      claimCalls += 1;
      if (claimCalls > 3) return [];
      return [deliveryRow({ id: claimCalls, eventId: 100 + claimCalls })];
    });

    const processed = await claimAndRunDomainEventDeliveriesWithBudget({
      consumer: "zoho",
      batchSize: 10,
      leaseMs: 30_000,
      timeBudgetMs: 5_000,
      repo,
      deliverOne: async () => ({ ok: true }),
    });

    expect(processed).toBe(3);
    expect(repo.claim).toHaveBeenCalledTimes(4);
  });
});
