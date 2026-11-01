import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { coverAnalysis, legalEntity, lot, sale, user } from "@auction/db/schema";
import type { SaleCoverSlot } from "@auction/types";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleCoverAnalysisReader } from "./drizzle-cover-analysis.reader.js";
import { DrizzleSaleCoverRepository } from "./drizzle-sale-cover.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const slot = (key: string): SaleCoverSlot => ({
  key,
  width: 3200,
  height: 1400,
  focal: { x: 0.7, y: 0.5 },
  zoom: 1,
  alt: "A harbour",
  analysisHash: `hash-${key}`,
});

describe.skipIf(!HAS_DB)("DrizzleSaleCoverRepository (integration)", () => {
  it("sets slots one at a time, keeps home fields, pins in order and reads analyses", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const userId = `cover-user-${tag}`;
    const sellerId = randomUUID();
    const [saleA, saleB, saleC] = [randomUUID(), randomUUID(), randomUUID()];
    const [lotA, lotGone] = [randomUUID(), randomUUID()];

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: "Cora Cover",
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
        const newSale = (id: string, status: "active" | "draft") => ({
          id,
          title: `Sale ${id.slice(0, 4)}`,
          status,
          startTime: new Date(now.getTime() - 3_600_000),
          endTime: new Date(now.getTime() + 3_600_000),
          createdByLegalEntityId: sellerId,
          coverImages: ["legacy/a.jpg"],
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(sale)
          .values([newSale(saleA, "active"), newSale(saleB, "active"), newSale(saleC, "draft")]);
        const newLot = (id: string, deleted: boolean) => ({
          id,
          saleId: saleA,
          title: "Lot",
          auctionType: "english" as const,
          startingPrice: "100.00",
          currentPrice: "100.00",
          minBidIncrement: "10.00",
          sellerLegalEntityId: sellerId,
          images: ["uploads/lot-1.jpg", "uploads/lot-2.jpg"],
          startTime: new Date(now.getTime() - 3_600_000),
          endTime: new Date(now.getTime() + 3_600_000),
          deletedAt: deleted ? now : null,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(lot).values([newLot(lotA, false), newLot(lotGone, true)]);

        const covers = new DrizzleSaleCoverRepository(tx as never);

        // Slots change one at a time and a new sale has none.
        expect(await covers.getState(saleA)).toMatchObject({
          coverImages: ["legacy/a.jpg"],
          coverSlots: {},
        });
        await covers.setSlot(saleA, "default", slot("one.jpg"));
        await covers.setSlot(saleA, "wide", slot("two.jpg"));
        await covers.setSlot(saleA, "default", slot("three.jpg"));
        const state = await covers.getState(saleA);
        expect(Object.keys(state?.coverSlots ?? {}).sort()).toEqual(["default", "wide"]);
        expect(state?.coverSlots.default?.key).toBe("three.jpg");
        expect(state?.coverSlots.wide?.key).toBe("two.jpg");
        await covers.clearSlot(saleA, "default");
        expect(Object.keys((await covers.getState(saleA))?.coverSlots ?? {})).toEqual(["wide"]);
        expect(await covers.getState(randomUUID())).toBeNull();

        // Home fields.
        const deadline = new Date("2026-12-01T00:00:00.000Z");
        await covers.updateHome(saleA, {
          subtitle: "Evening sale",
          featuredLotIds: [lotA],
          consignmentDeadline: deadline,
        });
        await covers.updateHome(saleA, { subtitle: null });
        expect(await covers.getHome(saleA)).toEqual({
          subtitle: null,
          featuredLotIds: [lotA],
          consignmentDeadline: deadline,
          homePinOrder: null,
        });

        // Lots in the sale, without the deleted one.
        expect([...(await covers.listLotIds(saleA))]).toEqual([lotA]);
        expect(await covers.getLotImages(lotA)).toEqual({
          saleId: saleA,
          images: ["uploads/lot-1.jpg", "uploads/lot-2.jpg"],
        });
        expect(await covers.getLotImages(lotGone)).toBeNull();

        // Pins: replaced as a whole, each place held once.
        const statuses = await covers.getSaleStatuses([saleA, saleC, randomUUID()]);
        expect(statuses.get(saleA)).toBe("active");
        expect(statuses.get(saleC)).toBe("draft");
        expect(statuses.size).toBe(2);
        await covers.replaceHomePins([saleB, saleA]);
        expect((await covers.getHome(saleB))?.homePinOrder).toBe(1);
        expect((await covers.getHome(saleA))?.homePinOrder).toBe(2);
        const pinned = (await covers.listHomePins()).map((pin) => pin.saleId);
        expect(pinned).toEqual([saleB, saleA]);
        await covers.replaceHomePins([saleA]);
        expect((await covers.getHome(saleB))?.homePinOrder).toBeNull();
        expect((await covers.getHome(saleA))?.homePinOrder).toBe(1);

        // The database itself refuses a pin place taken twice.
        await expect(
          tx.transaction(async (inner) => {
            await inner.update(sale).set({ homePinOrder: 1 }).where(eq(sale.id, saleB));
          }),
        ).rejects.toThrow();

        // The analysis reader finds what the worker stored, by fingerprint.
        await tx.insert(coverAnalysis).values({ hash: `h-${tag}`, status: "failed" });
        const reader = new DrizzleCoverAnalysisReader(tx as never);
        const found = await reader.lookupByHashes([`h-${tag}`, "missing"]);
        expect([...found.keys()]).toEqual([`h-${tag}`]);
        expect(found.get(`h-${tag}`)).toMatchObject({ status: "failed", analysis: null });
        expect((await reader.lookupByHashes([])).size).toBe(0);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
