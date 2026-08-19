import type { IdentityDatabase } from "@auction/identity-db";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DELIVERED_SIGNAL_RETENTION_DAYS,
  FAILED_SIGNAL_RETENTION_DAYS,
  IDENTITY_RETENTION_BATCH_SIZE,
  OIDC_RP_SESSION_RETENTION_DAYS,
  purgeIdentityRetentionBatch,
  startIdentityRetentionSchedule,
} from "./identity-retention.schedule.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("Identity retention", () => {
  it("uses bounded deletes and distinct terminal-state cutoffs", async () => {
    const execute = vi.fn().mockResolvedValue({});
    const now = new Date("2026-08-13T00:00:00Z");
    await purgeIdentityRetentionBatch(
      { execute } as unknown as Pick<IdentityDatabase, "execute">,
      now,
    );

    expect(IDENTITY_RETENTION_BATCH_SIZE).toBe(500);
    expect(execute).toHaveBeenCalledTimes(3);
    const queries = execute.mock.calls.map(([statement]) => new PgDialect().sqlToQuery(statement));
    expect(queries.every(({ sql }) => sql.toLowerCase().includes("limit $"))).toBe(true);
    expect(queries.every(({ params }) => params.includes(IDENTITY_RETENTION_BATCH_SIZE))).toBe(
      true,
    );
    expect(
      queries[0]?.params.some(
        (param) =>
          param instanceof Date &&
          param.getTime() === now.getTime() - OIDC_RP_SESSION_RETENTION_DAYS * 24 * 60 * 60_000,
      ),
    ).toBe(true);
    for (const query of queries.slice(1)) {
      expect(
        query.params
          .filter((param): param is Date => param instanceof Date)
          .map((param) => param.getTime()),
      ).toEqual(
        expect.arrayContaining([
          now.getTime() - DELIVERED_SIGNAL_RETENTION_DAYS * 24 * 60 * 60_000,
          now.getTime() - FAILED_SIGNAL_RETENTION_DAYS * 24 * 60 * 60_000,
        ]),
      );
      expect(query.sql).toContain(`"status" = 'delivered'`);
      expect(query.sql).toContain(`"status" = 'failed'`);
    }
  });

  it("prevents overlap and waits for the active purge when stopped", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const execute = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({});
          }),
      )
      .mockResolvedValue({});
    const schedule = startIdentityRetentionSchedule({
      db: { execute } as unknown as Pick<IdentityDatabase, "execute">,
      onError: vi.fn(),
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(40);
    expect(execute).toHaveBeenCalledOnce();

    const stopped = schedule.stop();
    let completed = false;
    void stopped.then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);

    finish?.();
    await stopped;
    expect(completed).toBe(true);
  });
});
