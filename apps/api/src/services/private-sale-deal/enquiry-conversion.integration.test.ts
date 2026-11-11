import {
  ArtworkOfferLock,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, marketingEnquiry, privateSaleDeal } from "@auction/db/schema";
import { resolvePrivateSalePolicy } from "@auction/domain";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleDealWorkStore,
  DrizzleMarketingEnquiryRepository,
  DrizzlePrivateSaleDealQueryRepository,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { seedIdentityUserFixtures } from "../../testing/identity-user-fixtures.js";
import { recordingSink } from "./deal-fixtures.test-util.js";
import { ArtworkRegisterDealLock } from "./deal-register-lock.js";
import { EnquiryConversionService } from "./enquiry-conversion.service.js";

const url = process.env.DATABASE_URL;

const specialistId = "icf-conv-specialist";
const clientUserId = "icf-conv-client";
const clientEntityId = "a0d00000-0000-4000-8000-0000000000e1";
const enquiryId = "a0d00000-0000-4000-8000-0000000000e2";
const t = new Date("2026-11-01T00:00:00Z");

class Rollback extends Error {}

describe.skipIf(!url)(
  "converting an enquiry into a deal with an artwork (Postgres)",
  { timeout: 30_000 },
  () => {
    async function inRollback(
      run: (ctx: {
        service: EnquiryConversionService;
        tx: Database;
        registers: DrizzleArtworkRegisterRepository;
        newArtwork: (zohoProductId: string) => Promise<string>;
      }) => Promise<void>,
    ) {
      const db = createDb(url as string);
      try {
        await db.transaction(async (outer) => {
          const tx = outer as unknown as Database;
          await seedIdentityUserFixtures(
            tx,
            [specialistId, clientUserId].map((id) => ({
              id,
              name: id,
              email: `${id}@integration.test`,
              createdAt: t,
            })),
          );
          await tx.insert(legalEntity).values({
            id: clientEntityId,
            displayName: "Henry Lowe",
            kind: "organisation",
            subkind: "company",
            createdByUserId: clientUserId,
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
          await tx.insert(marketingEnquiry).values({
            id: enquiryId,
            intent: "private_sale_sell",
            topic: "selling",
            name: "Henry Lowe",
            email: "henry@example.com",
            message: "A landscape",
            status: "in_progress",
            assignedToUserId: specialistId,
            userId: clientUserId,
            legalEntityId: clientEntityId,
          });
          const registers = new DrizzleArtworkRegisterRepository(db).withExecutor(tx);
          const newArtwork = async (zohoProductId: string) => {
            const entry: NewArtworkRegisterEntry = {
              zohoProductId,
              stockCode: `LAX-ORI-PH-GAC-26-${zohoProductId.padStart(4, "0")}`,
              kind: "original",
              sourceOriginalId: null,
              title: "Harbour at dusk",
              artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
              medium: null,
              dimensions: null,
              year: 2024,
              imageRefs: [],
              catalogueStatus: "Available",
            };
            const created = await registers.create(entry, "zoho", t);
            if (!created.ok) throw new Error(created.reason);
            return created.entry.id;
          };
          const service = new EnquiryConversionService({
            enquiries: new DrizzleMarketingEnquiryRepository(tx),
            works: new DrizzleDealWorkStore(tx),
            openDeals: new DrizzlePrivateSaleDealQueryRepository(tx),
            dealsForTx: (executor) => new DrizzlePrivateSaleDealRepository(executor),
            artworks: registers,
            registerForTx: (executor) =>
              new ArtworkRegisterDealLock<Database>(
                executor,
                (session) =>
                  new ArtworkOfferLock(
                    new DrizzleArtworkRegisterRepository(db).withExecutor(session),
                  ),
              ),
            parties: {
              resolve: async () => ({ legalEntityId: clientEntityId, actingUserId: clientUserId }),
            } as never,
            policy: resolvePrivateSalePolicy({ commissionRateBps: 1500 }),
            // A savepoint of the test's transaction: what the service undoes is undone for real.
            transactionRunner: { runInTransaction: (fn) => tx.transaction(fn) as never },
            events: recordingSink(),
          });
          await run({ service, tx, registers, newArtwork });
          throw new Rollback();
        });
      } catch (error) {
        if (!(error instanceof Rollback)) throw error;
      }
    }

    const VIEWER = { userId: specialistId, readsPrivateSale: true };

    it("opens the deal and holds the artwork for it", async () => {
      await inRollback(async ({ service, tx, registers, newArtwork }) => {
        const artworkId = await newArtwork("9101");
        const result = await service.convert(VIEWER, await enquiryRef(tx), {
          artworkRegisterId: artworkId,
        });
        expect(result.ok).toBe(true);
        const [deal] = await tx
          .select()
          .from(privateSaleDeal)
          .where(eq(privateSaleDeal.sourceEnquiryId, enquiryId));
        expect(deal?.artworkRegisterId).toBe(artworkId);
        expect((await registers.findById(artworkId))?.offer).toMatchObject({
          state: "private_sale",
          ref: { kind: "private_sale", id: deal?.id },
        });
      });
    });

    it("leaves no deal, no work and the enquiry unconverted when the artwork is live elsewhere", async () => {
      await inRollback(async ({ service, tx, registers, newArtwork }) => {
        const artworkId = await newArtwork("9102");
        await new ArtworkOfferLock(registers).offer(
          { registerId: artworkId },
          { kind: "shop_artwork", id: "art-1" },
          "staff:u2",
        );

        const result = await service.convert(VIEWER, await enquiryRef(tx), {
          artworkRegisterId: artworkId,
        });
        expect(result).toMatchObject({ ok: false, error: "artwork_unavailable" });
        expect((result as { message?: string }).message).toMatch(/lax\.art/);

        expect(
          await tx
            .select()
            .from(privateSaleDeal)
            .where(eq(privateSaleDeal.sourceEnquiryId, enquiryId)),
        ).toHaveLength(0);
        expect(await tx.select().from(itemSubmission)).toHaveLength(0);
        const [enquiry] = await tx
          .select({ status: marketingEnquiry.status })
          .from(marketingEnquiry)
          .where(eq(marketingEnquiry.id, enquiryId));
        expect(enquiry?.status).toBe("in_progress");
        expect((await registers.findById(artworkId))?.offer.state).toBe("lax_art");
      });
    });
  },
);

async function enquiryRef(tx: Database): Promise<string> {
  const [row] = await tx
    .select({ reference: marketingEnquiry.reference })
    .from(marketingEnquiry)
    .where(eq(marketingEnquiry.id, enquiryId));
  if (!row) throw new Error("enquiry missing");
  return row.reference;
}
