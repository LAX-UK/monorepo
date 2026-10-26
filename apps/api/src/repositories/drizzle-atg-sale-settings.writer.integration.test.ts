import { type Database, createDb } from "@auction/db";
import { atgAuctionLink, legalEntity, sale, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAtgLinkReader } from "./drizzle-atg-link.reader.js";
import { DrizzleAtgSaleSettingsWriter } from "./drizzle-atg-sale-settings.writer.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleAtgSaleSettingsWriter (integration)", () => {
  const saleId = "a7c00000-0000-4000-8000-000000000001";
  const sellerUserId = "atg-settings-seller";
  const sellerLeId = "a7c00000-0000-4000-8000-000000000002";
  const at = new Date("2026-10-14T09:00:00Z");

  it("creates the link row, then refuses changes the ATG state no longer allows", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_atg_settings_test");
    const t = new Date("2026-10-01T00:00:00Z");

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: sellerUserId,
          name: "Seller",
          email: "atg-settings-seller@integration.test",
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(legalEntity).values({
          id: sellerLeId,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: sellerUserId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(sale).values({
          id: saleId,
          title: "ATG settings sale",
          startTime: new Date("2026-10-20T10:00:00Z"),
          endTime: new Date("2026-11-01T18:00:00Z"),
          createdByLegalEntityId: sellerLeId,
        });
        const txDb = tx as unknown as Database;
        const writer = new DrizzleAtgSaleSettingsWriter(txDb);
        const reader = new DrizzleAtgLinkReader(txDb);

        expect((await reader.getSaleView(saleId))?.settings).toEqual({
          auctionType: "Timed",
          distribution: "private_test",
        });

        const live = { auctionType: "Live", distribution: "private_test" } as const;
        expect(await writer.saveSettings(saleId, live, "staff-1", at)).toBe(true);
        expect(await reader.getSaleView(saleId)).toMatchObject({
          linked: false,
          settings: live,
          settingsUpdatedAt: at.toISOString(),
        });
        const [row] = await tx
          .select()
          .from(atgAuctionLink)
          .where(eq(atgAuctionLink.saleId, saleId));
        expect(row).toMatchObject({ remoteStatus: "pending", settingsUpdatedBy: "staff-1" });

        await tx
          .update(atgAuctionLink)
          .set({ atgAuctionId: "atg-a", remoteStatus: "created" })
          .where(eq(atgAuctionLink.saleId, saleId));
        expect(
          await writer.saveSettings(saleId, { ...live, auctionType: "Timed" }, "staff-2", at),
        ).toBe(false);
        const publicLive = { auctionType: "Live", distribution: "public_marketplace" } as const;
        expect(await writer.saveSettings(saleId, publicLive, "staff-2", at)).toBe(true);

        await tx
          .update(atgAuctionLink)
          .set({ remoteStatus: "published" })
          .where(eq(atgAuctionLink.saleId, saleId));
        expect(await writer.saveSettings(saleId, live, "staff-3", at)).toBe(false);
        expect((await reader.getSaleView(saleId))?.settings).toEqual(publicLive);
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
