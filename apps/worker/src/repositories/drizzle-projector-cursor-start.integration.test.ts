import { closeDb, createDb, domainEvent, projectorState } from "@auction/db";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { WorkerDb } from "../workers/types.js";
import { DrizzleProjectorCursorStart } from "./drizzle-projector-cursor-start.js";

const workerUrl = process.env.DATABASE_URL_WORKER;

class RolledBack extends Error {}

/** Every case runs as `worker_app` in a transaction that is rolled back. */
describe.skipIf(!workerUrl)("projector cursor start (integration)", { timeout: 30_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by workerUrl
  const owned = createDb(workerUrl!);
  const db = owned as unknown as WorkerDb;
  afterAll(async () => {
    await closeDb(owned);
  });

  async function rolledBack(work: (tx: WorkerDb) => Promise<void>): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        await work(tx as unknown as WorkerDb);
        throw new RolledBack();
      });
    } catch (error) {
      if (!(error instanceof RolledBack)) throw error;
    }
  }

  const NAME = "cursor_start_probe";

  async function cursorOf(tx: WorkerDb): Promise<number | undefined> {
    const [row] = await tx
      .select({ id: projectorState.lastProcessedEventId })
      .from(projectorState)
      .where(eq(projectorState.projectorName, NAME));
    return row?.id;
  }

  async function emit(tx: WorkerDb): Promise<number> {
    const [row] = await tx
      .insert(domainEvent)
      .values({
        aggregateType: "probe",
        aggregateId: "probe",
        eventType: "probe.emitted",
        payload: {},
        producer: "apps/worker",
      })
      .returning({ id: domainEvent.id });
    return row?.id ?? 0;
  }

  it("moves an existing cursor forward to the newest event, never back", async () => {
    await rolledBack(async (tx) => {
      const cursor = new DrizzleProjectorCursorStart(tx);
      const first = await emit(tx);
      await cursor.startAtLatestEvent(NAME);
      expect(await cursorOf(tx)).toBe(first);

      // Events written while the projector is off are passed over, not kept for later.
      await emit(tx);
      const newest = await emit(tx);
      await cursor.startAtLatestEvent(NAME);
      expect(await cursorOf(tx)).toBe(first);
      await cursor.moveToLatestEvent(NAME);
      expect(await cursorOf(tx)).toBe(newest);

      // A cursor already past the newest event is left where it is.
      await tx
        .update(projectorState)
        .set({ lastProcessedEventId: newest + 1_000 })
        .where(eq(projectorState.projectorName, NAME));
      await cursor.moveToLatestEvent(NAME);
      expect(await cursorOf(tx)).toBe(newest + 1_000);
    });
  });

  it("creates the cursor at the newest event when there is none", async () => {
    await rolledBack(async (tx) => {
      const newest = await emit(tx);
      await new DrizzleProjectorCursorStart(tx).moveToLatestEvent(NAME);
      expect(await cursorOf(tx)).toBe(newest);
    });
  });
});
