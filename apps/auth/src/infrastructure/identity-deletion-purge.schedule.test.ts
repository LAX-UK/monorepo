import type { IdentityDatabase } from "@auction/identity-db";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IDENTITY_DELETION_GRACE_DAYS,
  IDENTITY_DELETION_PURGE_BATCH_SIZE,
  purgeDeletedSubjectsBatch,
  startIdentityDeletionPurgeSchedule,
} from "./identity-deletion-purge.schedule.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("Identity deletion purge", () => {
  it("uses the grace-period cutoff and a bounded idempotent candidate query", async () => {
    const execute = vi.fn().mockResolvedValue({ rowCount: 2 });
    const now = new Date("2026-08-19T00:00:00Z");

    await expect(
      purgeDeletedSubjectsBatch({ execute } as unknown as Pick<IdentityDatabase, "execute">, now),
    ).resolves.toBe(2);

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

  it("prevents overlapping runs and waits for the active purge when stopped", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const execute = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ rowCount: 0 });
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
