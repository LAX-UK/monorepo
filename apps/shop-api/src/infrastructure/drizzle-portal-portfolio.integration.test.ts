import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopCertificate,
  shopDocument,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
  shopRefund,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { createDrizzlePortalPortfolioRepository } from "./drizzle-portal-portfolio.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;

/**
 * Shop and lax.art facts for one person: the editions they own (and what they paid), their
 * originals, unpaid orders, sales, orders and refunds. Another person's records, a price paid
 * by a previous owner and abandoned checkouts must never leak in. Rolled back, so it leaves
 * no rows behind.
 */
describe.skipIf(!ownerUrl)("portal portfolio reader (integration)", () => {
  it("reads one person's holdings and money and nothing else", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by ownerUrl
    const db = createDb(ownerUrl!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const subject = `portfolio-me-${tag}`;
    const otherSubject = `portfolio-other-${tag}`;
    const id = () => randomUUID();
    const [meParty, otherParty, artistParty] = [id(), id(), id()];
    const artistId = id();
    const [boughtArt, originalArt, pendingArt, offeredArt, resoldArt] = [
      id(),
      id(),
      id(),
      id(),
      id(),
    ];
    const [boughtEdition, pendingEdition, offeredEdition, resoldEdition] = [id(), id(), id(), id()];
    const [paidOrder, pendingOrder, expiredOrder, otherOrder] = [id(), id(), id(), id()];
    const [paidLine, pendingLine, otherLine] = [id(), id(), id()];
    const documentId = id();
    const originalSaleId = id();
    const ledgerId = id();
    const refundId = id();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(shopParty).values([
          { id: meParty, displayName: "Me", identitySubjectId: subject },
          { id: otherParty, displayName: "Other", identitySubjectId: otherSubject },
          { id: artistParty, displayName: "Ines Okafor" },
        ]);
        await tx.insert(shopArtist).values({
          id: artistId,
          partyId: artistParty,
          slug: `ines-${tag}`,
        });
        const artwork = (
          artworkId: string,
          name: string,
          salesChannel: "shop" | "art",
          hasCertificate = false,
        ) => ({
          id: artworkId,
          slug: `${name}-${tag}`,
          title: name,
          primaryImageUrl: `artworks/${name}.jpg`,
          artistId,
          eligibleForEditionAllocation: true,
          importKey: `portfolio:${artworkId}`,
          salesChannel,
          hasCertificate,
        });
        await tx
          .insert(shopArtwork)
          .values([
            artwork(boughtArt, "bought", "shop", true),
            artwork(originalArt, "original", "art"),
            artwork(pendingArt, "pending", "shop"),
            artwork(offeredArt, "offered", "shop"),
            artwork(resoldArt, "resold", "shop"),
          ]);

        const newOrder = (
          orderId: string,
          buyerSubject: string,
          buyerPartyId: string,
          fields: Partial<typeof shopOrder.$inferInsert>,
        ): typeof shopOrder.$inferInsert => ({
          id: orderId,
          identitySubjectId: buyerSubject,
          buyerPartyId,
          fulfilment: "uk_insured_delivery",
          merchandiseSubtotalPence: 45_000,
          fulfilmentSurchargePence: 2_500,
          totalPence: 47_500,
          idempotencyKey: `portfolio-${orderId}`,
          ...fields,
        });
        await tx.insert(shopOrder).values([
          newOrder(paidOrder, subject, meParty, {
            status: "paid",
            paidAt: new Date("2026-05-02T12:00:00.000Z"),
          }),
          newOrder(pendingOrder, subject, meParty, {
            status: "pending_payment",
            checkoutExpiresAt: new Date(Date.now() + 3_600_000),
          }),
          newOrder(expiredOrder, subject, meParty, { status: "expired" }),
          newOrder(otherOrder, otherSubject, otherParty, {
            status: "paid",
            paidAt: new Date("2026-02-01T12:00:00.000Z"),
          }),
        ]);

        await tx.insert(shopEdition).values([
          {
            id: boughtEdition,
            artworkId: boughtArt,
            editionNumber: 1,
            allocation: "original_buyer_entitlement",
            ownerPartyId: meParty,
            listingStatus: "sold",
            custodyStatus: "in_transit",
          },
          {
            id: pendingEdition,
            artworkId: pendingArt,
            editionNumber: 1,
            allocation: "lax",
            ownerPartyId: otherParty,
            listingStatus: "reserved",
          },
          {
            id: offeredEdition,
            artworkId: offeredArt,
            editionNumber: 1,
            allocation: "artist",
            ownerPartyId: meParty,
            listingStatus: "authorised",
          },
          {
            id: resoldEdition,
            artworkId: resoldArt,
            editionNumber: 1,
            allocation: "lax",
            ownerPartyId: meParty,
            listingStatus: "sold",
          },
        ]);
        await tx.insert(shopOrderLine).values([
          {
            id: paidLine,
            orderId: paidOrder,
            editionId: boughtEdition,
            artworkId: boughtArt,
            editionNumber: 1,
            unitPricePence: 45_000,
          },
          {
            id: pendingLine,
            orderId: pendingOrder,
            editionId: pendingEdition,
            artworkId: pendingArt,
            editionNumber: 1,
            unitPricePence: 30_000,
          },
          // A previous owner's order: its price must not be shown to the current owner.
          {
            id: otherLine,
            orderId: otherOrder,
            editionId: resoldEdition,
            artworkId: resoldArt,
            editionNumber: 1,
            unitPricePence: 99_000,
          },
        ]);
        await tx.insert(shopFulfilment).values({
          orderId: paidOrder,
          option: "uk_insured_delivery",
          status: "in_transit",
        });
        await tx.insert(shopDocument).values({
          id: documentId,
          partyId: meParty,
          kind: "certificate",
          objectKey: `documents/${tag}.pdf`,
        });
        await tx.insert(shopCertificate).values({
          editionId: boughtEdition,
          documentId,
          issuedAt: new Date("2026-05-10T00:00:00.000Z"),
        });
        await tx.insert(shopOriginalSale).values({
          id: originalSaleId,
          artworkId: originalArt,
          buyerPartyId: meParty,
          status: "assigned",
          salePricePence: 1_200_000,
          salesChannel: "art",
          recordedBySubjectId: "staff-1",
        });
        await tx.insert(shopRefund).values({
          id: refundId,
          orderId: paidOrder,
          amountPence: 10_000,
          status: "succeeded",
          idempotencyKey: `portfolio-refund-${tag}`,
          requestedBySubjectId: "staff-1",
        });
        await tx.insert(shopPayoutLedger).values([
          {
            id: ledgerId,
            orderLineId: otherLine,
            ownerPartyId: meParty,
            grossPence: 100_000,
            deductionsPence: 20_000,
            netPence: 80_000,
            payoutDueAt: new Date("2026-04-01T00:00:00.000Z"),
            status: "paid",
            paidAt: new Date("2026-04-03T10:00:00.000Z"),
          },
        ]);

        const reader = createDrizzlePortalPortfolioRepository(tx as never);
        const result = await reader.loadFacts(subject, { includeSales: true });

        // Editions: the bought one with price, shipping on the first line, fulfilment and
        // certificate; the one on offer with no purchase; the resold one without the old price.
        const byId = new Map(result.editions.map((e) => [e.editionId, e]));
        expect([...byId.keys()].sort()).toEqual(
          [boughtEdition, offeredEdition, resoldEdition].sort(),
        );
        expect(byId.get(boughtEdition)).toMatchObject({
          listingStatus: "sold",
          certificate: "issued",
          work: {
            title: "bought",
            artistName: "Ines Okafor",
            imageKey: "artworks/bought.jpg",
            channel: "shop",
          },
          purchase: {
            orderId: paidOrder,
            orderStatus: "paid",
            channel: "shop",
            unitPricePence: 45_000,
            shippingPence: 2_500,
            fulfilmentStatus: "in_transit",
          },
        });
        expect(byId.get(offeredEdition)).toMatchObject({
          listingStatus: "authorised",
          purchase: null,
          certificate: "none",
        });
        expect(byId.get(resoldEdition)?.purchase).toBeNull();

        // Originals: the person's assigned sale, with its own channel.
        expect(result.originals).toEqual([
          expect.objectContaining({
            originalSaleId,
            channel: "art",
            status: "assigned",
            salePricePence: 1_200_000,
            work: expect.objectContaining({ title: "original", channel: "art" }),
          }),
        ]);

        // Pending: only the live checkout, never the expired one or another person's order.
        expect(result.pendingOrderLines).toEqual([
          expect.objectContaining({
            orderLineId: pendingLine,
            orderId: pendingOrder,
            unitPricePence: 30_000,
            shippingPence: 2_500,
            work: expect.objectContaining({ title: "pending" }),
          }),
        ]);

        // Sales: the payout traced back to its artwork.
        expect(result.sales).toEqual([
          expect.objectContaining({
            payoutId: ledgerId,
            netPence: 80_000,
            deductionsPence: 20_000,
            status: "paid",
            work: expect.objectContaining({ title: "resold" }),
          }),
        ]);

        // Orders and refunds: the person's own only.
        expect(result.orders.map((o) => o.orderId).sort()).toEqual(
          [paidOrder, pendingOrder, expiredOrder].sort(),
        );
        expect(result.refunds).toEqual([
          expect.objectContaining({ refundId, orderId: paidOrder, amountPence: 10_000 }),
        ]);

        // Sales are left out when payouts are switched off.
        const withoutSales = await reader.loadFacts(subject, { includeSales: false });
        expect(withoutSales.sales).toEqual([]);

        // A person with no party still gets their orders, and nothing else.
        const stranger = await reader.loadFacts(`portfolio-missing-${tag}`, {
          includeSales: true,
        });
        expect(stranger).toEqual({
          editions: [],
          originals: [],
          pendingOrderLines: [],
          sales: [],
          orders: [],
          refunds: [],
        });

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
