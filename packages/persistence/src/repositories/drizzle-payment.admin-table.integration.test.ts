import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidUserProfile, legalEntity, lot, payment, sale, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The staff Payments list names each payment's lot by number and sale on its second line. Runs
 * in a transaction that is rolled back, so it leaves no rows behind.
 */
describe.skipIf(!HAS_DB)("admin payments table (integration)", () => {
  it("returns the lot number and sale title, and nothing for a lot outside a sale", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const buyerId = `admin-table-buyer-${tag}`;
    const sellerEntityId = randomUUID();
    const buyerEntityId = randomUUID();
    const saleId = randomUUID();
    const inSale = randomUUID();
    const standalone = randomUUID();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: buyerId,
          name: buyerId,
          email: `${buyerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(bidUserProfile).values({ userId: buyerId, createdAt: now, updatedAt: now });
        await tx.insert(legalEntity).values(
          [sellerEntityId, buyerEntityId].map((id) => ({
            id,
            displayName: id,
            kind: "organisation" as const,
            subkind: "gallery" as const,
            createdByUserId: buyerId,
            status: "approved" as const,
            createdAt: now,
            updatedAt: now,
          })),
        );
        await tx.insert(sale).values({
          id: saleId,
          title: `Autumn sale ${tag}`,
          startTime: new Date(now.getTime() - 86_400_000),
          endTime: new Date(now.getTime() - 3_600_000),
          createdByLegalEntityId: sellerEntityId,
        });
        const newLot = (id: string, inSaleId: string | null, lotNumber: number | null) => ({
          id,
          sellerLegalEntityId: sellerEntityId,
          saleId: inSaleId,
          lotNumber,
          title: `Admin table lot ${tag} ${id.slice(0, 4)}`,
          images: [],
          auctionType: "english" as const,
          startingPrice: "100.00",
          currentPrice: "250.00",
          minBidIncrement: "10.00",
          startTime: new Date(now.getTime() - 86_400_000),
          endTime: new Date(now.getTime() - 3_600_000),
          status: "ended" as const,
          winnerId: buyerId,
          buyerLegalEntityId: buyerEntityId,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(lot).values([newLot(inSale, saleId, 12), newLot(standalone, null, null)]);
        await tx.insert(payment).values(
          [inSale, standalone].map((lotId) => ({
            lotId,
            buyerId,
            buyerLegalEntityId: buyerEntityId,
            sellerLegalEntityId: sellerEntityId,
            amount: "250.00",
            platformFee: "25.00",
            createdAt: now,
          })),
        );

        const rows = await new DrizzlePaymentRepository(tx).listForAdminTable({
          q: `Admin table lot ${tag}`,
          limit: 10,
          offset: 0,
        });
        const byLot = new Map(rows.map((row) => [row.lotId, row]));
        expect(byLot.get(inSale)).toMatchObject({ lotNumber: 12, saleTitle: `Autumn sale ${tag}` });
        expect(byLot.get(standalone)).toMatchObject({ lotNumber: null, saleTitle: null });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
