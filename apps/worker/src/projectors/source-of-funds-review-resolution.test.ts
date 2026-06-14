import type pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processSourceOfFundsReviewResolution } from "./source-of-funds-review-resolution.js";

function fakeDb(results: unknown[]) {
  const make = () => {
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === "then") {
          const value = results.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return () => proxy;
      },
    });
    return proxy;
  };
  return new Proxy(
    {},
    {
      get() {
        return () => make();
      },
    },
  ) as never;
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as pino.Logger;

describe("processSourceOfFundsReviewResolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("resolves a pending review task when the case is terminal", async () => {
    const eventRow = {
      id: 12,
      aggregateId: "sof_1",
      actorUserId: "mlro_1",
      payload: {
        sourceOfFundsId: "sof_1",
        userId: "u1",
        status: "approved",
      },
    };
    const db = fakeDb([
      undefined,
      [{ last: 0 }],
      [eventRow],
      [{ status: "approved" }],
      [{ id: "task_1", status: "pending" }],
      undefined,
      undefined,
    ]);

    await processSourceOfFundsReviewResolution({ db, log });

    expect(log.info).toHaveBeenCalledWith(
      { sourceOfFundsId: "sof_1", taskId: "task_1" },
      "source_of_funds_review_task_resolved",
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it("advances the cursor when the task is already resolved", async () => {
    const eventRow = {
      id: 13,
      aggregateId: "sof_2",
      actorUserId: "mlro_1",
      payload: { sourceOfFundsId: "sof_2", status: "approved" },
    };
    const db = fakeDb([
      undefined,
      [{ last: 0 }],
      [eventRow],
      [{ status: "approved" }],
      [{ id: "task_2", status: "resolved" }],
      undefined,
    ]);

    await processSourceOfFundsReviewResolution({ db, log });

    expect(log.info).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("warns and advances when no matching task exists", async () => {
    const eventRow = {
      id: 14,
      aggregateId: "sof_missing",
      actorUserId: "mlro_1",
      payload: { sourceOfFundsId: "sof_missing", status: "approved" },
    };
    const db = fakeDb([
      undefined,
      [{ last: 0 }],
      [eventRow],
      [{ status: "rejected" }],
      [],
      undefined,
    ]);

    await processSourceOfFundsReviewResolution({ db, log });

    expect(log.warn).toHaveBeenCalledWith(
      { sourceOfFundsId: "sof_missing" },
      "source_of_funds_review_task_not_found_for_resolution",
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it("skips resolution (without resolving the task) when the case is no longer terminal", async () => {
    // Reopen replayed before an older reviewed event in a backlog: the case is
    // pending again, so the reactivated task must stay open.
    const eventRow = {
      id: 15,
      aggregateId: "sof_reopened",
      actorUserId: "mlro_1",
      payload: { sourceOfFundsId: "sof_reopened", status: "rejected" },
    };
    const db = fakeDb([undefined, [{ last: 0 }], [eventRow], [{ status: "pending" }], undefined]);

    await processSourceOfFundsReviewResolution({ db, log });

    expect(log.info).toHaveBeenCalledWith(
      { sourceOfFundsId: "sof_reopened", caseStatus: "pending" },
      "source_of_funds_review_resolution_skipped_non_terminal",
    );
    expect(log.error).not.toHaveBeenCalled();
  });
});
