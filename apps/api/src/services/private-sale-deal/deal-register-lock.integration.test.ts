import {
  ArtworkOfferLock,
  type ArtworkRegisterEntry,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, privateSaleDeal } from "@auction/db/schema";
import { resolvePrivateSalePolicy } from "@auction/domain";
import {
  DrizzleArtworkRegisterRepository,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { seedIdentityUserFixtures } from "../../testing/identity-user-fixtures.js";
import { recordingSink } from "./deal-fixtures.test-util.js";
import {
  ArtworkRegisterDealLock,
  DealArtworkRefused,
  type IDealRegisterLock,
} from "./deal-register-lock.js";
import { DealTransitionService } from "./deal-transition.service.js";

const url = process.env.DATABASE_URL;

const staffId = "icf-it-staff";
const sellerUserId = "icf-it-seller";
const sellerEntityId = "a0d00000-0000-4000-8000-0000000000f1";
const t = new Date("2026-11-01T00:00:00Z");
const POLICY = resolvePrivateSalePolicy({ commissionRateBps: 1500 });
const CLEAR = {
  seller: { kyc: "clear", aml: "clear" },
  buyer: { kyc: "clear", aml: "clear" },
  buyerSourceOfFunds: "approved",
  buyerOtherOpenExposureMinor: 0,
} as never;

class Rollback extends Error {}

describe.skipIf(!url)(
  "private sale deals and the artwork register (Postgres)",
  {
    timeout: 30_000,
  },
  () => {
    /** Everything runs in one transaction that is always rolled back. */
    async function inRollback(
      run: (ctx: {
        tx: Database;
        registers: DrizzleArtworkRegisterRepository;
        lockFor: (executor: Database) => IDealRegisterLock;
        newArtwork: (zohoProductId: string) => Promise<ArtworkRegisterEntry>;
        newDeal: (artworkRegisterId: string | null) => Promise<string>;
      }) => Promise<void>,
    ) {
      const db = createDb(url as string);
      try {
        await db.transaction(async (tx) => {
          const executor = tx as unknown as Database;
          await seedIdentityUserFixtures(
            executor,
            [staffId, sellerUserId].map((id) => ({
              id,
              name: id,
              email: `${id}@integration.test`,
              createdAt: t,
            })),
          );
          await executor.insert(legalEntity).values({
            id: sellerEntityId,
            displayName: "Henry Lowe",
            kind: "organisation",
            subkind: "company",
            createdByUserId: sellerUserId,
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
          const registers = new DrizzleArtworkRegisterRepository(db).withExecutor(executor);
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
            return created.entry;
          };
          const newDeal = async (artworkRegisterId: string | null) => {
            const [submission] = await executor
              .insert(itemSubmission)
              .values({
                legalEntityId: sellerEntityId,
                title: "Low tide at Maldon",
                status: "approved",
                submittedByUserId: sellerUserId,
              })
              .returning({ id: itemSubmission.id });
            const deal = await new DrizzlePrivateSaleDealRepository(executor).create({
              itemSubmissionId: submission?.id as string,
              ...(artworkRegisterId ? { artworkRegisterId } : {}),
              ownerUserId: staffId,
              seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
              buyerFeeBps: 0,
              sellerCommissionBps: 1500,
              actorUserId: staffId,
            });
            return deal.id;
          };
          const lockFor = (e: Database) =>
            new ArtworkRegisterDealLock(
              new ArtworkOfferLock(new DrizzleArtworkRegisterRepository(db).withExecutor(e)),
            );
          await run({ tx: executor, registers, lockFor, newArtwork, newDeal });
          throw new Rollback();
        });
      } catch (error) {
        if (!(error instanceof Rollback)) throw error;
      }
    }

    function transitionsOver(tx: Database, lockFor: (e: Database) => IDealRegisterLock) {
      const scopeForTx = (executor: Database) => ({
        deals: new DrizzlePrivateSaleDealRepository(executor),
        events: recordingSink(),
        register: lockFor(executor),
      });
      return new DealTransitionService({
        scope: scopeForTx(tx),
        clearance: { snapshot: async () => CLEAR },
        policy: POLICY,
      });
    }

    it("holds the artwork for the deal, refuses a second deal, and a retry changes nothing", async () => {
      await inRollback(async ({ tx, registers, lockFor, newArtwork, newDeal }) => {
        const artwork = await newArtwork("9001");
        const first = await newDeal(artwork.id);
        const second = await newDeal(artwork.id);
        const lock = lockFor(tx);

        await lock.offer(artwork.id, first, "staff:u1");
        await lock.offer(artwork.id, first, "staff:u1");
        expect((await registers.findById(artwork.id))?.offer).toEqual({
          state: "private_sale",
          ref: { kind: "private_sale", id: first },
        });
        await expect(lock.offer(artwork.id, second, "staff:u1")).rejects.toBeInstanceOf(
          DealArtworkRefused,
        );
      });
    });

    it("refuses an artwork that is live on lax.art or in a Bid lot", async () => {
      await inRollback(async ({ tx, registers, lockFor, newArtwork, newDeal }) => {
        const onShop = await newArtwork("9002");
        const inLot = await newArtwork("9003");
        const deal = await newDeal(null);
        const register = new ArtworkOfferLock(registers);
        await register.offer(
          { registerId: onShop.id },
          { kind: "shop_artwork", id: "art-1" },
          "staff:u2",
        );
        await register.offer(
          { registerId: inLot.id },
          { kind: "bid_lot", id: "lot-1" },
          "staff:u2",
        );

        await expect(lockFor(tx).offer(onShop.id, deal, "staff:u1")).rejects.toThrow(/lax\.art/);
        await expect(lockFor(tx).offer(inLot.id, deal, "staff:u1")).rejects.toThrow(
          /LAX Bid|Bid sale/,
        );
        expect((await registers.findById(onShop.id))?.offer.state).toBe("lax_art");
        expect((await registers.findById(inLot.id))?.offer.state).toBe("bid_sale");
      });
    });

    it("leaves no hold behind when the transaction that made it is rolled back", async () => {
      await inRollback(async ({ tx, registers, lockFor, newArtwork, newDeal }) => {
        const artwork = await newArtwork("9004");
        const deal = await newDeal(artwork.id);
        await tx
          .transaction(async (inner) => {
            await lockFor(inner as unknown as Database).offer(artwork.id, deal, "staff:u1");
            throw new Rollback();
          })
          .catch((error) => {
            if (!(error instanceof Rollback)) throw error;
          });
        expect((await registers.findById(artwork.id))?.offer.state).toBe("held");
      });
    });

    it("withdraws the hold when the deal is cancelled", async () => {
      await inRollback(async ({ tx, registers, lockFor, newArtwork, newDeal }) => {
        const artwork = await newArtwork("9005");
        const deal = await newDeal(artwork.id);
        await lockFor(tx).offer(artwork.id, deal, "staff:u1");

        const outcome = await transitionsOver(tx, lockFor).transition(deal, "cancel", {
          actorUserId: staffId,
          cancelReason: "Seller withdrew the work",
        });
        expect(outcome.kind).toBe("ok");
        expect((await registers.findById(artwork.id))?.offer.state).toBe("withdrawn");
      });
    });

    it("marks the artwork sold through the deal when the deal is paid", async () => {
      await inRollback(async ({ tx, registers, lockFor, newArtwork, newDeal }) => {
        const artwork = await newArtwork("9006");
        const deal = await newDeal(artwork.id);
        await lockFor(tx).offer(artwork.id, deal, "staff:u1");
        await tx
          .update(privateSaleDeal)
          .set({
            stage: "invoiced",
            priceMinor: 4_800_000,
            agreedAt: t,
            vatTreatment: "margin_scheme",
            paymentDueAt: t,
          })
          .where(eq(privateSaleDeal.id, deal));

        const outcome = await transitionsOver(tx, lockFor).transition(deal, "mark_paid", {
          actorUserId: staffId,
        });
        expect(outcome.kind).toBe("ok");
        expect((await registers.findById(artwork.id))?.offer).toMatchObject({
          state: "sold",
          ref: { kind: "private_sale", id: deal },
        });
      });
    });
  },
);
