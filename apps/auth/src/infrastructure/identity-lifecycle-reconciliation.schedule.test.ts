import type { IdentityDatabase } from "@auction/identity-db";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  reconcileIdentityLifecycleOutbox,
  startIdentityLifecycleReconciliationSchedule,
} from "./identity-lifecycle-reconciliation.schedule.js";

function database(results: Array<{ rows: unknown[]; rowCount: number }>) {
  const execute = vi.fn(async () => results.shift() ?? { rows: [], rowCount: 0 });
  const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => unknown) =>
    operation({ execute }),
  );
  return {
    db: { transaction } as unknown as IdentityDatabase,
    execute,
    transaction,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Identity lifecycle outbox reconciliation", () => {
  it("repairs missing registered, verified, and profile snapshot events under one lock", async () => {
    const { db, execute, transaction } = database([
      { rows: [{ lock_acquired: true }], rowCount: 1 },
      { rows: [], rowCount: 2 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 3 },
      { rows: [], rowCount: 1 },
    ]);

    await expect(
      reconcileIdentityLifecycleOutbox(db, new Date("2026-09-05T00:00:00Z")),
    ).resolves.toEqual({
      registered: 2,
      emailVerified: 1,
      profileUpdated: 3,
      credentialChanged: 1,
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(5);
  });

  it("does not reconcile when another replica owns the transaction lock", async () => {
    const { db, execute } = database([{ rows: [{ lock_acquired: false }], rowCount: 1 }]);

    await expect(reconcileIdentityLifecycleOutbox(db)).resolves.toEqual({
      registered: 0,
      emailVerified: 0,
      profileUpdated: 0,
      credentialChanged: 0,
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("surfaces schedule failures and waits for the active pass on shutdown", async () => {
    vi.useFakeTimers();
    const { db } = database([]);
    vi.mocked(db.transaction).mockRejectedValueOnce(new Error("database unavailable"));
    const onError = vi.fn();
    const schedule = startIdentityLifecycleReconciliationSchedule({
      db,
      onError,
      intervalMs: 10,
    });

    await vi.advanceTimersByTimeAsync(0);
    await schedule.stop();

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "database unavailable" }),
    );
  });
});
