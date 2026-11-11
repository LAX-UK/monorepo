import {
  ArtworkOfferLock,
  type ArtworkRegisterEntry,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, privateSaleDealArtworkHistory } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  DrizzlePrivateSaleDealQueryRepository,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { seedIdentityUserFixtures } from "../../testing/identity-user-fixtures.js";
import { DealArtworkService } from "./deal-artwork.service.js";
import { recordingSink } from "./deal-fixtures.test-util.js";
import { DealLockLinks } from "./deal-lock-links.js";
import { ArtworkRegisterDealLock } from "./deal-register-lock.js";
import type { DealStaffViewer } from "./deal-staff-permissions.js";

const url = process.env.DATABASE_URL;

const staffId = "icf-art-staff";
const sellerUserId = "icf-art-seller";
const sellerEntityId = "a0d00000-0000-4000-8000-0000000000a1";
const t = new Date("2026-11-01T00:00:00Z");
const MANAGER: DealStaffViewer = {
  userId: staffId,
  abilities: { manage: true, finance: false, release: false },
  checks: true,
  scope: { kind: "all" },
};

class Rollback extends Error {}

describe.skipIf(!url)(
  "linking, changing and removing a deal's artwork (Postgres)",
  { timeout: 30_000 },
  () => {
    async function inRollback(
      run: (ctx: {
        service: DealArtworkService;
        tx: Database;
        registers: DrizzleArtworkRegisterRepository;
        deals: DrizzlePrivateSaleDealRepository;
        events: ReturnType<typeof recordingSink>;
        newArtwork: (zohoProductId: string) => Promise<ArtworkRegisterEntry>;
        newDeal: (artworkRegisterId: string | null) => Promise<{ id: string; reference: string }>;
      }) => Promise<void>,
    ) {
      const db = createDb(url as string);
      try {
        await db.transaction(async (outer) => {
          const tx = outer as unknown as Database;
          await seedIdentityUserFixtures(
            tx,
            [staffId, sellerUserId].map((id) => ({
              id,
              name: id,
              email: `${id}@integration.test`,
              createdAt: t,
            })),
          );
          await tx.insert(legalEntity).values({
            id: sellerEntityId,
            displayName: "Henry Lowe",
            kind: "organisation",
            subkind: "company",
            createdByUserId: sellerUserId,
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
          const registers = new DrizzleArtworkRegisterRepository(db).withExecutor(tx);
          const deals = new DrizzlePrivateSaleDealRepository(tx);
          const events = recordingSink();
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
            const [submission] = await tx
              .insert(itemSubmission)
              .values({
                legalEntityId: sellerEntityId,
                title: "Low tide at Maldon",
                status: "approved",
                submittedByUserId: sellerUserId,
              })
              .returning({ id: itemSubmission.id });
            const deal = await deals.create({
              itemSubmissionId: submission?.id as string,
              ...(artworkRegisterId ? { artworkRegisterId } : {}),
              ownerUserId: staffId,
              seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
              buyerFeeBps: 0,
              sellerCommissionBps: 1500,
              actorUserId: staffId,
            });
            return { id: deal.id, reference: deal.reference };
          };
          const service = new DealArtworkService({
            deals,
            artworks: registers,
            // A savepoint of the test's transaction: what the service undoes is undone for real.
            transactionRunner: { runInTransaction: (fn) => tx.transaction(fn) as never },
            scopeForTx: (executor) => ({
              deals: new DrizzlePrivateSaleDealRepository(executor),
              events: events as never,
              register: new ArtworkRegisterDealLock<Database>(
                executor,
                (session) =>
                  new ArtworkOfferLock(
                    new DrizzleArtworkRegisterRepository(db).withExecutor(session),
                  ),
              ),
            }),
            lockLinks: new DealLockLinks({}, new DrizzlePrivateSaleDealQueryRepository(tx)),
            records: {
              recordOf: async (_viewer, deal) => ({ reference: deal.reference }) as never,
            },
          });
          await run({ service, tx, registers, deals, events, newArtwork, newDeal });
          throw new Rollback();
        });
      } catch (error) {
        if (!(error instanceof Rollback)) throw error;
      }
    }

    it("links: holds the artwork for the deal, writes the history row, and a second deal is refused", async () => {
      await inRollback(async ({ service, registers, deals, newArtwork, newDeal }) => {
        const artwork = await newArtwork("9101");
        const deal = await newDeal(null);
        const other = await newDeal(null);

        const linked = await service.set(MANAGER, deal.reference, {
          version: 1,
          artworkRegisterId: artwork.id,
        });
        expect(linked.ok).toBe(true);
        expect((await registers.findById(artwork.id))?.offer).toEqual({
          state: "private_sale",
          ref: { kind: "private_sale", id: deal.id },
        });
        expect((await deals.findById(deal.id))?.artworkRegisterId).toBe(artwork.id);
        expect(await deals.artworkHistory(deal.id)).toMatchObject([
          { action: "linked", actorUserId: staffId, toArtworkRegisterId: artwork.id, reason: null },
        ]);

        const second = await service.set(MANAGER, other.reference, {
          version: 1,
          artworkRegisterId: artwork.id,
        });
        expect(second).toMatchObject({
          ok: false,
          error: "artwork_unavailable",
          lock: { reason: "in_private_sale" },
        });
        expect((await deals.findById(other.id))?.artworkRegisterId).toBeNull();
        expect(await deals.artworkHistory(other.id)).toEqual([]);
      });
    });

    it("changes: releases the old artwork and holds the new one together, with the reason and before and after", async () => {
      await inRollback(async ({ service, registers, deals, events, newArtwork, newDeal }) => {
        const first = await newArtwork("9102");
        const second = await newArtwork("9103");
        const deal = await newDeal(first.id);
        // The deal was opened holding the first artwork.
        await new ArtworkOfferLock(registers).offer(
          { registerId: first.id },
          { kind: "private_sale", id: deal.id },
          "staff:setup",
        );

        const changed = await service.set(MANAGER, deal.reference, {
          version: 1,
          artworkRegisterId: second.id,
          reason: "The buyer chose the other study.",
        });
        expect(changed.ok).toBe(true);
        expect((await registers.findById(first.id))?.offer.state).toBe("withdrawn");
        expect((await registers.findById(second.id))?.offer).toEqual({
          state: "private_sale",
          ref: { kind: "private_sale", id: deal.id },
        });
        expect(await deals.artworkHistory(deal.id)).toMatchObject([
          {
            action: "changed",
            actorUserId: staffId,
            fromArtworkRegisterId: first.id,
            toArtworkRegisterId: second.id,
            reason: "The buyer chose the other study.",
          },
        ]);
        expect(events.events.map((e) => e.eventType)).toContain(
          "private_sale_deal.artwork_changed",
        );
      });
    });

    it("keeps everything as it was when the register refuses the new artwork", async () => {
      await inRollback(async ({ service, tx, registers, deals, newArtwork, newDeal }) => {
        const first = await newArtwork("9104");
        const onShop = await newArtwork("9105");
        const deal = await newDeal(first.id);
        const lock = new ArtworkOfferLock(registers);
        await lock.offer(
          { registerId: first.id },
          { kind: "private_sale", id: deal.id },
          "staff:s",
        );
        await lock.offer(
          { registerId: onShop.id },
          { kind: "shop_artwork", id: "art-1" },
          "staff:s",
        );

        const result = await service.set(MANAGER, deal.reference, {
          version: 1,
          artworkRegisterId: onShop.id,
          reason: "Try the live one.",
        });
        expect(result).toMatchObject({ ok: false, error: "artwork_unavailable" });
        // The old artwork is still held for the deal, the deal still points at it, and there is no history.
        expect((await registers.findById(first.id))?.offer.state).toBe("private_sale");
        expect((await deals.findById(deal.id))?.artworkRegisterId).toBe(first.id);
        expect((await deals.findById(deal.id))?.version).toBe(1);
        const rows = await tx
          .select()
          .from(privateSaleDealArtworkHistory)
          .where(eq(privateSaleDealArtworkHistory.dealId, deal.id));
        expect(rows).toEqual([]);
      });
    });

    it("removes: releases the artwork and records the reason there is none", async () => {
      await inRollback(async ({ service, registers, deals, newArtwork, newDeal }) => {
        const artwork = await newArtwork("9106");
        const deal = await newDeal(artwork.id);
        await new ArtworkOfferLock(registers).offer(
          { registerId: artwork.id },
          { kind: "private_sale", id: deal.id },
          "staff:s",
        );
        const removed = await service.remove(MANAGER, deal.reference, {
          version: 1,
          notInRegister: { reason: "in_zoho_not_linked" },
          reason: "Wrong record picked.",
        });
        expect(removed.ok).toBe(true);
        expect((await registers.findById(artwork.id))?.offer.state).toBe("withdrawn");
        const after = await deals.findById(deal.id);
        expect(after).toMatchObject({
          artworkRegisterId: null,
          artworkUnlinkedReason: "in_zoho_not_linked",
        });
        expect(await deals.artworkHistory(deal.id)).toMatchObject([
          {
            action: "removed",
            fromArtworkRegisterId: artwork.id,
            toArtworkRegisterId: null,
            toUnlinkedReason: "in_zoho_not_linked",
            reason: "Wrong record picked.",
          },
        ]);
      });
    });

    it("refuses a change made against an out-of-date version, and holds nothing", async () => {
      await inRollback(async ({ service, registers, deals, newArtwork, newDeal }) => {
        const artwork = await newArtwork("9107");
        const deal = await newDeal(null);
        expect(
          await service.set(MANAGER, deal.reference, { version: 7, artworkRegisterId: artwork.id }),
        ).toMatchObject({ ok: false, error: "stale_version", currentVersion: 1 });
        expect((await registers.findById(artwork.id))?.offer.state).toBe("held");
        expect((await deals.findById(deal.id))?.artworkRegisterId).toBeNull();
      });
    });
  },
);
