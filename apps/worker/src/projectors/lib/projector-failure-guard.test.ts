import { describe, expect, it, vi } from "vitest";
import { recordProjectorEventFailure } from "./projector-failure-guard.js";

function mockDb(lastError: string | null = null) {
  const updates: Array<{ lastError: string }> = [];
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ lastError }]),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: { lastError: string }) => {
        updates.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  };
  return { db, updates };
}

describe("recordProjectorEventFailure", () => {
  it("retries until poison threshold then skips", async () => {
    const log = { error: vi.fn() };
    const projector = "source_of_funds_documents";
    let prior: string | null = null;

    for (let i = 1; i <= 4; i++) {
      const { db, updates } = mockDb(prior);
      const outcome = await recordProjectorEventFailure({
        db: db as never,
        log: log as never,
        projectorName: projector,
        eventId: 42,
        err: new Error(`fail-${i}`),
      });
      expect(outcome.action).toBe("retry");
      prior = updates[0]?.lastError ?? null;
    }

    const { db, updates } = mockDb(prior);
    const outcome = await recordProjectorEventFailure({
      db: db as never,
      log: log as never,
      projectorName: projector,
      eventId: 42,
      err: new Error("fail-5"),
    });
    expect(outcome.action).toBe("skip");
    expect(updates[0]?.lastError).toContain("Skipped poison event 42");
  });
});
