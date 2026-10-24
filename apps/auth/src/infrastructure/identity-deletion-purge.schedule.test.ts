import type { IdentityDatabase } from "@auction/identity-db";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IDENTITY_DELETION_GRACE_DAYS,
  IDENTITY_DELETION_PURGE_BATCH_SIZE,
  purgeDeletedSubjectsBatch,
  startIdentityDeletionPurgeSchedule,
} from "./identity-deletion-purge.schedule.js";

const SUBJECT_A = "4c8d1a2e-7b39-4e60-9f15-a2d3c6b8e071";
const SUBJECT_B = "9e2f6b04-3a71-4d8c-b5e0-1c7a9d4f2863";

afterEach(() => {
  vi.useRealTimers();
});

describe("Identity deletion purge", () => {
  it("uses the grace-period cutoff and a bounded idempotent candidate query", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: SUBJECT_A }, { id: SUBJECT_B }] });
    const now = new Date("2026-08-19T00:00:00Z");

    await expect(
      purgeDeletedSubjectsBatch({ execute } as unknown as Pick<IdentityDatabase, "execute">, now),
    ).resolves.toEqual([SUBJECT_A, SUBJECT_B]);

    const statement = execute.mock.calls[0]?.[0];
    const query = new PgDialect().sqlToQuery(statement);
    expect(query.sql).toContain("LIMIT $");
    expect(query.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(query.sql).toContain("user_pii_purge");
    expect(query.sql).toContain("INSERT INTO identity_lifecycle_outbox");
    expect(query.sql).toContain("user.identity_deleted");
    expect(query.sql).toContain("@purged.invalid");
    expect(query.params).toContain(IDENTITY_DELETION_PURGE_BATCH_SIZE);
    expect(query.params).toContainEqual(
      new Date(now.getTime() - IDENTITY_DELETION_GRACE_DAYS * 24 * 60 * 60_000),
    );
  });

  it("ends each purged person's sessions and back-channel logout after the batch", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: SUBJECT_A }, { id: SUBJECT_B }] });
    const endSessions = vi.fn().mockResolvedValue(undefined);
    const onPurged = vi.fn();
    const schedule = startIdentityDeletionPurgeSchedule({
      db: { execute } as unknown as Pick<IdentityDatabase, "execute">,
      onError: vi.fn(),
      onPurged,
      endSessions,
      intervalMs: 60_000,
    });
    await schedule.stop();

    expect(endSessions.mock.calls).toEqual([[SUBJECT_A], [SUBJECT_B]]);
    expect(onPurged).toHaveBeenCalledWith(2);
  });

  it("prevents overlapping runs and waits for the active purge when stopped", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const execute = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ rows: [] });
        }),
    );
    const schedule = startIdentityDeletionPurgeSchedule({
      db: { execute } as unknown as Pick<IdentityDatabase, "execute">,
      onError: vi.fn(),
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(execute).toHaveBeenCalledOnce();

    const stopped = schedule.stop();
    finish?.();
    await stopped;
  });
});
