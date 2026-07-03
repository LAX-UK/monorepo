import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, lotLifecycleSnapshot, user } from "@auction/db/schema";
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
    const sellerUserId = `lot-lifecycle-snapshot-${randomUUID()}`;
    const sellerLegalEntityId = randomUUID();
    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: sellerUserId,
          name: "Snapshot Seller",
          email: `${sellerUserId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values({
          id: sellerLegalEntityId,
          displayName: "Snapshot Seller Entity",
          kind: "individual",
          subkind: "private_collector",
          createdByUserId: sellerUserId,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(lot).values({
          id: lotId,
          sellerLegalEntityId,
          title: "Lot lifecycle snapshot integration lot",
          images: [],
          auctionType: "english",
          startingPrice: "100.00",
          currentPrice: "100.00",
          minBidIncrement: "10.00",
          startTime: new Date(now.getTime() - 86_400_000),
          endTime: new Date(now.getTime() + 86_400_000),
          status: "draft",
          createdAt: now,
          updatedAt: now,
        });

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
