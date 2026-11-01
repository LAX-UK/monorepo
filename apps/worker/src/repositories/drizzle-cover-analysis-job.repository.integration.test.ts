import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, sale, user } from "@auction/db/schema";
import { coverAnalysisHash } from "@auction/domain";
import type { SaleCoverSlot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { DrizzleCoverAnalysisJobRepository } from "./drizzle-cover-analysis-job.repository.js";
import { DrizzleMediaAssetCleanupRepository } from "./drizzle-media-asset-cleanup.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

function slot(key: string, zoom = 1): SaleCoverSlot {
  const draft = {
    key,
    width: 3200,
    height: 1400,
    focal: { x: 0.7, y: 0.5 },
    zoom,
    alt: "A harbour",
  };
  return { ...draft, analysisHash: coverAnalysisHash("default", draft) };
}

describe.skipIf(!HAS_DB)("cover analysis job repository (integration)", () => {
  it("lists slots without an analysis once, keeps outcomes, and counts slot pictures as in use", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const userId = `analysis-user-${tag}`;
    const sellerId = randomUUID();
    const [saleA, saleB, saleGone] = [randomUUID(), randomUUID(), randomUUID()];
    const shared = slot(`uploads/${tag}-shared.jpg`);
    const detail: SaleCoverSlot = {
      ...slot(`unused-${tag}`),
      fromLot: { lotId: randomUUID(), imageKey: `uploads/${tag}-lot.jpg` },
    };

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: "Ada Analysis",
          email: `${userId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values({
          id: sellerId,
          displayName: "Seller",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: userId,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        const newSale = (id: string, slots: object, deletedAt: Date | null = null) => ({
          id,
          title: `Sale ${id.slice(0, 4)}`,
          startTime: new Date(now.getTime() - 3_600_000),
          endTime: new Date(now.getTime() + 3_600_000),
          createdByLegalEntityId: sellerId,
          coverSlots: slots as never,
          deletedAt,
          createdAt: now,
          updatedAt: new Date(now.getTime() + 1000),
        });
        await tx.insert(sale).values([
          newSale(saleA, { default: shared, wide: detail }),
          // The same picture and crop on another sale shares one analysis.
          newSale(saleB, { default: shared }),
          newSale(saleGone, { default: slot(`uploads/${tag}-deleted.jpg`) }, now),
        ]);

        const repo = new DrizzleCoverAnalysisJobRepository(tx as never);
        const mine = (rows: Awaited<ReturnType<typeof repo.listPending>>) =>
          rows.filter((row) => [saleA, saleB, saleGone].some((id) => id === row.saleId));

        const pending = mine(await repo.listPending(1000));
        expect(pending.map((row) => row.slot.analysisHash).sort()).toEqual(
          [shared.analysisHash, detail.analysisHash].sort(),
        );
        expect(pending.find((row) => row.slot.fromLot)?.name).toBe("wide");

        await repo.save(shared.analysisHash, { status: "failed" });
        expect(mine(await repo.listPending(1000)).map((row) => row.name)).toEqual(["wide"]);

        // A later outcome replaces an earlier one.
        await repo.save(shared.analysisHash, {
          status: "ready",
          analysis: {
            version: 1,
            dominant: "#303030",
            deepest: "#101010",
            field: "#101010",
            blurDataURL: "data:image/jpeg;base64,AAAA",
            breakpoints: {},
          },
        });
        const stored = await tx.execute<{ status: string }>(
          `select status from cover_analysis where hash = '${shared.analysisHash}'` as never,
        );
        expect(stored.rows[0]?.status).toBe("ready");

        // Pictures held only by a cover slot are still in use, so cleanup keeps them.
        const cleanup = new DrizzleMediaAssetCleanupRepository(tx as never);
        expect(await cleanup.isKeyReferenced([`uploads/${tag}-shared.jpg`, "x"])).toBe(true);
        expect(await cleanup.isKeyReferenced([`uploads/${tag}-lot.jpg`])).toBe(true);
        expect(await cleanup.isKeyReferenced([`uploads/${tag}-nowhere.jpg`])).toBe(false);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
