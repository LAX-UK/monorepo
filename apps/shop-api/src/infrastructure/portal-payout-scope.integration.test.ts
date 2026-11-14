import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopOriginalSale,
  shopParty,
  shopPayoutLedger,
  shopThirdPartySale,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { createDrizzlePortalOwnershipRepository } from "./drizzle-portal-ownership.repository.js";
import { createDrizzlePortalPortfolioRepository } from "./drizzle-portal-portfolio.repository.js";
import { createDrizzlePortalSalesRepository } from "./drizzle-portal-sales.repository.js";
import { SellingPayoutsCategory } from "./subject-export/categories/selling-payouts.category.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const ORIGINS = { shop: "https://shop.example", art: "https://art.example" };

/**
 * One gallery party represents three artists. Two of them have portal access; the third has none.
 * Each artist sees only payouts for their own works, through every reader that shows payouts
 * (payouts list, sales list, portfolio, data export). The gallery, signed in as itself, sees all
 * of them. Rolled back, so it leaves no rows behind.
 */
describe.skipIf(!ownerUrl)("portal payout scope (integration)", () => {
  it("scopes a shared gallery party's payouts to each artist", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by ownerUrl
    const db = createDb(ownerUrl!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const id = () => randomUUID();
    const subjects = {
      a: `payout-artist-a-${tag}`,
      b: `payout-artist-b-${tag}`,
      gallery: `payout-gallery-${tag}`,
    };
    const [gallery, buyer] = [id(), id()];
    const [artistA, artistB, artistC] = [id(), id(), id()];
    const [workA, workB, workC] = [id(), id(), id()];
    const [orderId, lineA, editionA, editionB, resaleB, originalC] = [
      id(),
      id(),
      id(),
      id(),
      id(),
      id(),
    ];
    const [payoutA, payoutB, payoutC] = [id(), id(), id()];

    try {
      await db.transaction(async (tx) => {
        await tx.insert(shopParty).values([
          {
            id: gallery,
            displayName: "Gallery",
            kind: "gallery",
            identitySubjectId: subjects.gallery,
          },
          { id: buyer, displayName: "Buyer" },
        ]);
        await tx.insert(shopArtist).values([
          { id: artistA, partyId: gallery, slug: `a-${tag}`, identitySubjectId: subjects.a },
          { id: artistB, partyId: gallery, slug: `b-${tag}`, identitySubjectId: subjects.b },
          { id: artistC, partyId: gallery, slug: `c-${tag}` },
        ]);
        const work = (artworkId: string, artistId: string, name: string) => ({
          id: artworkId,
          slug: `${name}-${tag}`,
          title: name,
          artistId,
          eligibleForEditionAllocation: true,
          importKey: `payout-scope:${artworkId}`,
        });
        await tx
          .insert(shopArtwork)
          .values([
            work(workA, artistA, "work-a"),
            work(workB, artistB, "work-b"),
            work(workC, artistC, "work-c"),
          ]);

        // Artist A: a print sold online. Artist B: a resale recorded by staff. Artist C: an original.
        await tx.insert(shopOrder).values({
          id: orderId,
          identitySubjectId: `payout-buyer-${tag}`,
          buyerPartyId: buyer,
          fulfilment: "uk_insured_delivery",
          merchandiseSubtotalPence: 10_000,
          fulfilmentSurchargePence: 0,
          totalPence: 10_000,
          idempotencyKey: `payout-scope-${tag}`,
          status: "paid",
          paidAt: new Date("2026-05-02T12:00:00.000Z"),
        });
        const sold = (editionId: string, artworkId: string) => ({
          id: editionId,
          artworkId,
          editionNumber: 1,
          stockRef: 1,
          allocation: "artist" as const,
          ownerPartyId: buyer,
          listingStatus: "sold" as const,
        });
        await tx.insert(shopEdition).values([sold(editionA, workA), sold(editionB, workB)]);
        await tx.insert(shopOrderLine).values({
          id: lineA,
          orderId,
          editionId: editionA,
          artworkId: workA,
          editionNumber: 1,
          unitPricePence: 10_000,
        });
        await tx.insert(shopThirdPartySale).values({
          id: resaleB,
          editionId: editionB,
          sellerPartyId: gallery,
          buyerPartyId: buyer,
          grossPence: 20_000,
          status: "recorded",
          recordedBySubjectId: "staff-1",
          recordedAt: new Date("2026-05-03T12:00:00.000Z"),
        });
        await tx.insert(shopOriginalSale).values({
          id: originalC,
          artworkId: workC,
          buyerPartyId: buyer,
          status: "assigned",
          salePricePence: 30_000,
          recordedBySubjectId: "staff-1",
        });
        const payout = (
          payoutId: string,
          netPence: number,
          link: Partial<typeof shopPayoutLedger.$inferInsert>,
        ): typeof shopPayoutLedger.$inferInsert => ({
          id: payoutId,
          ownerPartyId: gallery,
          grossPence: netPence,
          netPence,
          payoutDueAt: new Date("2026-06-01T00:00:00.000Z"),
          status: "due",
          ...link,
        });
        await tx
          .insert(shopPayoutLedger)
          .values([
            payout(payoutA, 10_000, { orderLineId: lineA }),
            payout(payoutB, 20_000, { source: "third_party_sale", thirdPartySaleId: resaleB }),
            payout(payoutC, 30_000, { source: "original_sale", originalSaleId: originalC }),
          ]);

        const scopedDb = tx as never;
        const ownership = createDrizzlePortalOwnershipRepository(scopedDb);
        const sales = createDrizzlePortalSalesRepository(scopedDb);
        const portfolio = createDrizzlePortalPortfolioRepository(scopedDb);
        const exported = new SellingPayoutsCategory({
          db: scopedDb,
          files: {} as never,
          origins: ORIGINS,
        });
        const seen = async (subject: string) => {
          const [payouts, saleRows, facts, count, page] = await Promise.all([
            ownership.listPayouts(subject),
            sales.listSales(subject),
            portfolio.loadFacts(subject, { includeSales: true }),
            exported.count(subject),
            exported.readPage(subject, null),
          ]);
          const fromExport = page.records.map((r) => String((r as { id: string }).id));
          expect(count).toBe(fromExport.length);
          return {
            payouts: payouts.map((p) => p.payoutId).sort(),
            sales: saleRows.map((s) => s.payoutId).sort(),
            portfolio: facts.sales.map((s) => s.payoutId).sort(),
            exported: fromExport.map((key) => key.replace("payout:", "")).sort(),
          };
        };
        const only = (...ids: string[]) => {
          const sorted = [...ids].sort();
          return { payouts: sorted, sales: sorted, portfolio: sorted, exported: sorted };
        };

        expect(await seen(subjects.a)).toEqual(only(payoutA));
        expect(await seen(subjects.b)).toEqual(only(payoutB));
        // The gallery, signed in as itself, represents all three artists.
        expect(await seen(subjects.gallery)).toEqual(only(payoutA, payoutB, payoutC));
        expect(await seen(`payout-nobody-${tag}`)).toEqual(only());

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
