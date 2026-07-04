import { describe, expect, it, vi } from "vitest";
import { DrizzleProjectorFailureRecorder } from "../../repositories/drizzle-projector-failure-recorder.js";

function mockStateRepo(lastError: string | null = null) {
  const updates: Array<{ projectorName: string; lastError: string }> = [];
  const stateRepo = {
    recordError: vi.fn(async (projectorName: string, error: string) => {
      updates.push({ projectorName, lastError: error });
    }),
    ensureCursor: vi.fn(),
    getCursor: vi.fn(),
    advanceCursor: vi.fn(),
    advanceCursorLiteralName: vi.fn(),
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ lastError }]),
        })),
      })),
    })),
  };
  return { stateRepo, db, updates };
}

describe("DrizzleProjectorFailureRecorder", () => {
  it("retries until poison threshold then skips", async () => {
    const log = { error: vi.fn() };
    const projector = "source_of_funds_documents";
    let prior: string | null = null;

    for (let i = 1; i <= 4; i++) {
      const { stateRepo, db, updates } = mockStateRepo(prior);
      const recorder = new DrizzleProjectorFailureRecorder(db as never, stateRepo as never);
      const outcome = await recorder.record({
        log: log as never,
        projectorName: projector,
        eventId: 42,
        err: new Error(`fail-${i}`),
      });
      expect(outcome.action).toBe("retry");
      prior = updates[0]?.lastError ?? null;
    }

    const { stateRepo, db } = mockStateRepo(prior);
    const recorder = new DrizzleProjectorFailureRecorder(db as never, stateRepo as never);
    const outcome = await recorder.record({
      log: log as never,
      projectorName: projector,
      eventId: 42,
      err: new Error("fail-5"),
    });
    expect(outcome.action).toBe("skip");
  });
});
