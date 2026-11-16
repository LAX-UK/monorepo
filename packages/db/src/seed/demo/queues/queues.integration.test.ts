import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { runMigrationsPerTransaction } from "../../../migrate-runner.js";
import * as schema from "../../../schema/index.js";
import { withTemporaryDatabase } from "../../../testing/temporary-database.js";
import { runLegacyDemoSeed } from "../../dev/legacy-demo-seed.js";
import { runDemoFull } from "../demo-full-seed.js";
import { QUEUE_SEEDERS } from "./index.js";
import { QUEUE_IDS } from "./queue-ids.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const NOW = Date.UTC(2026, 10, 16, 9, 0);

describe.skipIf(!url)("demo seed: an item in every staff queue", { timeout: 600_000 }, () => {
  it("fills each queue, and running it again adds nothing", async () => {
    await withTemporaryDatabase(async (pool, databaseUrl) => {
      await runMigrationsPerTransaction(pool);
      const previous = process.env.DATABASE_URL;
      process.env.DATABASE_URL = databaseUrl;
      try {
        await runLegacyDemoSeed();
      } finally {
        if (previous === undefined) Reflect.deleteProperty(process.env, "DATABASE_URL");
        else process.env.DATABASE_URL = previous;
      }
      const db = drizzle(pool, { schema });
      const first = await runDemoFull(db, NOW);
      expect(first.queues).toEqual(QUEUE_SEEDERS.map((s) => s.queue));

      const tables = [
        schema.purchaseProblem,
        schema.disputeCase,
        schema.subjectDataExport,
        schema.dataRequestErasureHold,
        schema.collectionBooking,
        schema.privateSaleDeal,
        schema.enquiryInboundQuarantine,
        schema.itemSubmission,
        schema.domainEvent,
        schema.lotFulfilment,
      ] as const;
      const tally = async () =>
        Promise.all(tables.map(async (t) => (await db.select({ n: count() }).from(t))[0]?.n));
      const before = await tally();
      await runDemoFull(db, NOW + 60_000);
      expect(await tally()).toEqual(before);

      const [storage] = await db
        .select()
        .from(schema.lotFulfilment)
        .where(eq(schema.lotFulfilment.status, "ready_for_collection"));
      expect(storage?.paymentClearedAt).toBeInstanceOf(Date);
      const [booking] = await db
        .select()
        .from(schema.collectionBooking)
        .where(eq(schema.collectionBooking.id, QUEUE_IDS.booking(1)));
      expect(booking?.status).toBe("booked");
    });
  });
});
