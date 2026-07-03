import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { lotLifecycleSnapshot } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleLotLifecycleSnapshotRepository } from "./drizzle-lot-lifecycle-snapshot.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleLotLifecycleSnapshotRepository (integration)", () => {
  it("upsertSnapshot seeds and updates returnCount on conflict", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const lotId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        const repo = new DrizzleLotLifecycleSnapshotRepository(tx);

        await repo.upsertSnapshot({
          lotId,
          snapshotPatch: {
            currentStatus: "draft",
            lastEventType: "lot.created",
            returnCountDelta: 0,
            attachedCountDelta: 1,
          },
          seedSnapshot: true,
        });

        await repo.upsertSnapshot({
          lotId,
          snapshotPatch: {
            lastEventType: "lot.returned_to_inventory",
            returnCountDelta: 1,
          },
        });

        const [row] = await tx
          .select()
          .from(lotLifecycleSnapshot)
          .where(eq(lotLifecycleSnapshot.lotId, lotId))
          .limit(1);

        expect(row?.attachedCount).toBe(1);
        expect(row?.returnCount).toBe(1);
        expect(row?.lastEventType).toBe("lot.returned_to_inventory");

        throw rollback;
      });
    } catch (e) {
      if (e !== rollback) throw e;
    }
  });
});
