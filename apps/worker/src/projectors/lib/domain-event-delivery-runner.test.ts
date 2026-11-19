import type {
  DomainEventDeliveryRow,
  IDomainEventDeliveryRepository,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AccountingProjectionNotYetError } from "../../finance/accounting/accounting-projection.service.js";
import {
  CRM_WAITING_MAX_MS,
  crmDealNotLinkedError,
  crmNoteInFlightError,
} from "../../integrations/crm/crm-gateway-error.js";
import { CRM_NOTE_PENDING_GRACE_MS } from "../../integrations/crm/handlers/crm-deal-sync-handler.js";
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
    countSkippedForEventTypes: vi.fn().mockResolvedValue(0),
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

describe("runDomainEventDelivery: waiting for an accounting document to settle (review N1)", () => {
  const waitingError = () =>
    new AccountingProjectionNotYetError("credit_in_flight", "LAX-BID-CN-x");

  it("a reversal waiting for its credit note uses up no attempt and is never dead-lettered", async () => {
    const repo = mockRepo();
    const now = new Date("2026-01-01T00:00:00Z");
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 12 }),
      repo,
      leaseMs: 30_000,
      maxAttempts: 12,
      deliver: async () => {
        throw waitingError();
      },
      now,
    });
    expect(repo.deadLetter).not.toHaveBeenCalled();
    const call = vi.mocked(repo.scheduleRetry).mock.calls[0]?.[0];
    expect(call).toMatchObject({ undoAttemptIncrement: true });
    expect((call?.nextRetryAt.getTime() ?? 0) - now.getTime()).toBeGreaterThanOrEqual(5 * 60_000);
  });

  it("a reversal whose issued credit note is missing from the books (credit_missing) uses up attempts and is dead-lettered at the cap (BK-9F4)", async () => {
    const missing = () => new AccountingProjectionNotYetError("credit_missing", "LAX-BID-CN-x");
    expect(missing()).toMatchObject({ retryable: true, waiting: false });
    expect(missing().retryAfterMs).toBeUndefined();

    const before = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 11 }),
      repo: before,
      leaseMs: 30_000,
      maxAttempts: 12,
      deliver: async () => {
        throw missing();
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(before.deadLetter).not.toHaveBeenCalled();
    expect(vi.mocked(before.scheduleRetry).mock.calls[0]?.[0]).toMatchObject({
      undoAttemptIncrement: false,
    });

    const atCap = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 12 }),
      repo: atCap,
      leaseMs: 30_000,
      maxAttempts: 12,
      deliver: async () => {
        throw missing();
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(atCap.deadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        lastError: "accounting_projection_not_yet:credit_missing:LAX-BID-CN-x",
      }),
    );
    expect(atCap.scheduleRetry).not.toHaveBeenCalled();
  });

  it("any other not-yet still uses up attempts and is dead-lettered at the cap", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 12 }),
      repo,
      leaseMs: 30_000,
      maxAttempts: 12,
      deliver: async () => {
        throw new AccountingProjectionNotYetError("credit_exceeds_invoice", "x");
      },
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(repo.deadLetter).toHaveBeenCalled();
    expect(repo.scheduleRetry).not.toHaveBeenCalled();
  });
});

/**
 * Runs one delivery through the runner again and again, as the claim loop would: each claim adds an
 * attempt, a retry may undo it, and the clock moves to the scheduled retry. Stops at success or
 * dead letter, or when `until` is passed.
 */
async function simulateDelivery(input: {
  createdAt: Date;
  /** The delivery's outcome at a time. */
  outcomeAt: (now: Date) => "wait_note" | "wait_deal" | "ok";
  until: Date;
  maxAttempts?: number;
}): Promise<{ end: "succeeded" | "dead_lettered" | "still_retrying"; at: Date; tries: number }> {
  let attempts = 0;
  let now = input.createdAt;
  let tries = 0;
  while (now < input.until) {
    attempts += 1; // the claim
    tries += 1;
    const repo = mockRepo();
    const outcome = input.outcomeAt(now);
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts, createdAt: input.createdAt }),
      repo,
      leaseMs: 30_000,
      maxAttempts: input.maxAttempts ?? 12,
      deliver: async () => {
        if (outcome === "ok") return { ok: true };
        throw outcome === "wait_note" ? crmNoteInFlightError() : crmDealNotLinkedError();
      },
      now,
    });
    if (vi.mocked(repo.markSucceeded).mock.calls.length > 0) {
      return { end: "succeeded", at: now, tries };
    }
    if (vi.mocked(repo.deadLetter).mock.calls.length > 0) {
      return { end: "dead_lettered", at: now, tries };
    }
    const retry = vi.mocked(repo.scheduleRetry).mock.calls[0]?.[0];
    if (!retry) throw new Error("neither retried, succeeded nor dead-lettered");
    if (retry.undoAttemptIncrement) attempts = Math.max(0, attempts - 1);
    now = retry.nextRetryAt;
  }
  return { end: "still_retrying", at: now, tries };
}

describe("runDomainEventDelivery: CRM waits use up no attempts (PR #1573 review, observations 1 and 2)", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const msAfterCreation = (ms: number) => new Date(createdAt.getTime() + ms);

  it("a note in flight at the attempt cap is retried a minute later, not dead-lettered", async () => {
    const repo = mockRepo();
    await runDomainEventDelivery({
      delivery: deliveryRow({ attempts: 12, createdAt }),
      repo,
      leaseMs: 30_000,
      maxAttempts: 12,
      deliver: async () => {
        throw crmNoteInFlightError();
      },
      now: msAfterCreation(60_000),
    });
    expect(repo.deadLetter).not.toHaveBeenCalled();
    const call = vi.mocked(repo.scheduleRetry).mock.calls[0]?.[0];
    expect(call).toMatchObject({ undoAttemptIncrement: true, lastError: "deal_note_in_flight" });
    expect(
      (call?.nextRetryAt.getTime() ?? 0) - msAfterCreation(60_000).getTime(),
    ).toBeGreaterThanOrEqual(60_000);
  });

  it("a note in flight waits out the whole grace period, then is sent, never dead-lettered", async () => {
    // The claimant's send timed out and Zoho did not create the note: the claim is taken over
    // once the grace period has run out (before the fix, ~14% dead-lettered first).
    const result = await simulateDelivery({
      createdAt,
      outcomeAt: (now) =>
        now.getTime() - createdAt.getTime() < CRM_NOTE_PENDING_GRACE_MS ? "wait_note" : "ok",
      until: msAfterCreation(CRM_WAITING_MAX_MS),
    });
    expect(result.end).toBe("succeeded");
    expect(result.at.getTime() - createdAt.getTime()).toBeGreaterThanOrEqual(
      CRM_NOTE_PENDING_GRACE_MS,
    );
    // About one look a minute, not a tight loop against Zoho.
    expect(result.tries).toBeLessThanOrEqual(CRM_NOTE_PENDING_GRACE_MS / 60_000 + 2);
  });

  it("a refund waiting for its deal is not dead-lettered while the paid delivery is still retryable", async () => {
    // A six-hour Zoho outage: the paid delivery's circuit-open retries use up no attempts, and now
    // neither do the refund's; the refund moves the deal once the paid event has created it.
    const outage = 6 * 60 * 60_000;
    const result = await simulateDelivery({
      createdAt,
      outcomeAt: (now) => (now.getTime() - createdAt.getTime() < outage ? "wait_deal" : "ok"),
      until: msAfterCreation(CRM_WAITING_MAX_MS),
    });
    expect(result.end).toBe("succeeded");
    expect(result.at.getTime() - createdAt.getTime()).toBeGreaterThanOrEqual(outage);
  });

  it.each([
    ["deal_note_in_flight", "wait_note"],
    ["deal_link_missing", "wait_deal"],
  ] as const)(
    "a %s wait still ends: past the waiting cap it uses up attempts and dead-letters",
    async (_code, wait) => {
      const result = await simulateDelivery({
        createdAt,
        outcomeAt: () => wait,
        until: msAfterCreation(CRM_WAITING_MAX_MS + 7 * 24 * 60 * 60_000),
      });
      expect(result.end).toBe("dead_lettered");
      expect(result.at.getTime() - createdAt.getTime()).toBeGreaterThanOrEqual(CRM_WAITING_MAX_MS);
      // At most the usual 12 attempts after the cap, each at most 15 minutes apart.
      expect(result.at.getTime() - createdAt.getTime()).toBeLessThan(
        CRM_WAITING_MAX_MS + 12 * 15 * 60_000 + 60_000,
      );
    },
  );
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
