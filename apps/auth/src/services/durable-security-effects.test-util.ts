import type {
  SecurityEffectJob,
  SecurityEffectOutboxRepository,
  StoredSecurityEffect,
} from "./durable-security-effects.js";

type Row = {
  id: string;
  job: SecurityEffectJob;
  status: "pending" | "running" | "abandoned";
  attemptCount: number;
  nextAttemptAt: Date;
  claimedAt: Date | null;
  lastError: string;
};

/**
 * An outbox that lives in a plain object, so a test can "restart" the issuer by building a new
 * `DurableSecurityEffects` over the same instance: the rows survive, the timers do not exist.
 */
export class InMemorySecurityEffectOutbox implements SecurityEffectOutboxRepository {
  readonly rows: Row[] = [];

  async enqueue(input: { job: SecurityEffectJob; error: string; nextAttemptAt: Date }) {
    this.rows.push({
      id: `row-${this.rows.length + 1}`,
      job: input.job,
      status: "pending",
      attemptCount: 1,
      nextAttemptAt: input.nextAttemptAt,
      claimedAt: null,
      lastError: input.error,
    });
  }

  async claimDue(input: { now: Date; staleBefore: Date; batchSize: number }) {
    for (const row of this.rows) {
      if (row.status === "running" && row.claimedAt && row.claimedAt <= input.staleBefore) {
        row.status = "pending";
        row.claimedAt = null;
      }
    }
    const due = this.rows
      .filter((row) => row.status === "pending" && row.nextAttemptAt <= input.now)
      .slice(0, input.batchSize);
    for (const row of due) {
      row.status = "running";
      row.claimedAt = input.now;
    }
    return due.map(
      (row): StoredSecurityEffect => ({ id: row.id, job: row.job, attemptCount: row.attemptCount }),
    );
  }

  async complete(id: string) {
    this.rows.splice(
      this.rows.findIndex((row) => row.id === id),
      1,
    );
  }

  async retryLater(input: {
    id: string;
    attemptCount: number;
    error: string;
    nextAttemptAt: Date;
  }) {
    const row = this.require(input.id);
    Object.assign(row, {
      status: "pending",
      claimedAt: null,
      attemptCount: input.attemptCount,
      lastError: input.error,
      nextAttemptAt: input.nextAttemptAt,
    });
  }

  async abandon(input: { id: string; attemptCount: number; error: string }) {
    Object.assign(this.require(input.id), {
      status: "abandoned",
      claimedAt: null,
      attemptCount: input.attemptCount,
      lastError: input.error,
    });
  }

  private require(id: string): Row {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`No outbox row ${id}`);
    return row;
  }
}
