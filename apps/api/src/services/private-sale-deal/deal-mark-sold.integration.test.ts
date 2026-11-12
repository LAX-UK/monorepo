import {
  ArtworkOfferLock,
  type ArtworkRegisterEntry,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, privateSaleDeal } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  DrizzlePrivateSaleDealQueryRepository,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { seedIdentityUserFixtures } from "../../testing/identity-user-fixtures.js";
import { DealMarkSoldService } from "./deal-mark-sold.service.js";
import { ArtworkRegisterDealLock } from "./deal-register-lock.js";
import type { DealStaffViewer } from "./deal-staff-permissions.js";

const url = process.env.DATABASE_URL;

const staffId = "dms-it-staff";
const sellerUserId = "dms-it-seller";
const sellerEntityId = "a0d00000-0000-4000-8000-0000000000e1";
const t = new Date("2026-11-01T00:00:00Z");
const viewer: DealStaffViewer = {
  userId: staffId,
  abilities: { manage: true, finance: false, release: false },
  checks: true,
  scope: { kind: "all" },
};

class Rollback extends Error {}

describe.skipIf(!url)(
  "Try again on a settled deal's artwork (Postgres)",
  { timeout: 30_000 },
  () => {
    async function inRollback(
      run: (ctx: {
        service: DealMarkSoldService;
        events: { eventType: string; payload: unknown }[];
        lock: ArtworkOfferLock;
        registers: DrizzleArtworkRegisterRepository;
        queries: DrizzlePrivateSaleDealQueryRepository;
        settledDeal: (artworkId: string, state: "held" | "offered_here") => Promise<string>;
        newArtwork: (id: string) => Promise<ArtworkRegisterEntry>;
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
          const lock = new ArtworkOfferLock(registers);
          const events: { eventType: string; payload: unknown }[] = [];
          const deals = new DrizzlePrivateSaleDealRepository(executor);
          const service = new DealMarkSoldService({
            deals,
            artworks: registers,
            transactionRunner: {
              runInTransaction: <T>(work: (tx: Database) => Promise<T>) => work(executor),
            } as never,
            scopeForTx: () => ({
              events: {
                publish: async (event: { eventType: string; payload: unknown }) => {
                  events.push(event);
                },
                withTx: () => {
                  throw new Error("unused");
                },
              } as never,
              register: new ArtworkRegisterDealLock<Database>(
                executor,
                (session) =>
                  new ArtworkOfferLock(
                    new DrizzleArtworkRegisterRepository(db).withExecutor(session),
                  ),
              ),
            }),
            lockLinks: {
              attach: async (items) =>
                items.map(({ lock: message }) => ({ ...message, link: null })),
            },
            records: {
              recordOf: async (_viewer, deal) => ({ reference: deal.reference }) as never,
            },
          });
          const newArtwork = async (id: string) => {
            const entry: NewArtworkRegisterEntry = {
              zohoProductId: id,
              stockCode: `LAX-ORI-PH-GAC-26-${id.padStart(4, "0")}`,
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
          const settledDeal = async (artworkId: string, state: "held" | "offered_here") => {
            const [submission] = await executor
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
              artworkRegisterId: artworkId,
              ownerUserId: staffId,
              seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
              buyerFeeBps: 0,
              sellerCommissionBps: 1500,
              actorUserId: staffId,
            });
            await executor
              .update(privateSaleDeal)
              .set({
                stage: "settled",
                priceMinor: 4_800_000,
                agreedAt: t,
                vatTreatment: "margin_scheme",
                sellerCommissionBps: 1500,
                paymentDueAt: t,
              })
              .where(eq(privateSaleDeal.id, deal.id));
            if (state === "offered_here") {
              await lock.offer(
                { registerId: artworkId },
                { kind: "private_sale", id: deal.id },
                "t",
              );
            }
            return deal.id;
          };
          await run({
            service,
            events,
            lock,
            registers,
            queries: new DrizzlePrivateSaleDealQueryRepository(executor),
            settledDeal,
            newArtwork,
          });
          throw new Rollback();
        });
      } catch (error) {
        if (!(error instanceof Rollback)) throw error;
      }
    }

    const reference = async (queries: DrizzlePrivateSaleDealQueryRepository, id: string) =>
      [...(await queries.findReferencesByIds([id])).values()][0] as string;

    it("marks the artwork sold through the deal, and repeating it changes nothing", async () => {
      await inRollback(async ({ service, events, registers, queries, settledDeal, newArtwork }) => {
        const art = await newArtwork("9101");
        const dealId = await settledDeal(art.id, "offered_here");
        const ref = await reference(queries, dealId);
        const open = async () =>
          (await queries.listSettlementFollowUps({ kind: "all" }, 100)).map((row) => row.dealId);
        expect(await open()).toContain(dealId);

        expect(await service.markSold(viewer, ref)).toMatchObject({ ok: true });
        expect((await registers.findById(art.id))?.offer).toEqual({
          state: "sold",
          ref: { kind: "private_sale", id: dealId },
        });
        expect(await open()).not.toContain(dealId);

        const version = (await registers.findById(art.id))?.version;
        expect(await service.markSold(viewer, ref)).toMatchObject({ ok: true });
        expect((await registers.findById(art.id))?.version).toBe(version);
        expect(events.map((e) => (e.payload as { outcome: string }).outcome)).toEqual([
          "marked",
          "already_marked",
        ]);
      });
    });

    it("marks a settled deal's artwork sold even when the hold was lost", async () => {
      await inRollback(async ({ service, registers, queries, settledDeal, newArtwork }) => {
        const art = await newArtwork("9102");
        const dealId = await settledDeal(art.id, "held");
        const result = await service.markSold(viewer, await reference(queries, dealId));
        expect(result.ok).toBe(true);
        expect((await registers.findById(art.id))?.offer.state).toBe("sold");
      });
    });

    it("refuses with the register's reason when the artwork is in another sale, and moves nothing", async () => {
      await inRollback(
        async ({ service, events, lock, registers, queries, settledDeal, newArtwork }) => {
          const art = await newArtwork("9103");
          const dealId = await settledDeal(art.id, "held");
          await lock.offer({ registerId: art.id }, { kind: "bid_lot", id: "lot-9" }, "t");
          const before = await registers.findById(art.id);

          const result = await service.markSold(viewer, await reference(queries, dealId));
          expect(result).toMatchObject({
            ok: false,
            error: "artwork_unavailable",
            lock: { reason: "in_bid_sale" },
          });
          expect(await registers.findById(art.id)).toEqual(before);
          expect(
            (await queries.listSettlementFollowUps({ kind: "all" }, 100)).find(
              (row) => row.dealId === dealId,
            )?.severity,
          ).toBe("urgent");
          expect(events.map((e) => (e.payload as { outcome: string }).outcome)).toEqual([
            "skipped",
          ]);
        },
      );
    });

    it("refuses an artwork the register shows sold some other way", async () => {
      await inRollback(async ({ service, lock, queries, settledDeal, newArtwork }) => {
        const art = await newArtwork("9104");
        const dealId = await settledDeal(art.id, "held");
        await lock.markSold({ registerId: art.id }, { kind: "bid_lot", id: "lot-9" }, "t");
        const result = await service.markSold(viewer, await reference(queries, dealId));
        expect(result).toMatchObject({
          ok: false,
          error: "artwork_unavailable",
          lock: { reason: "sold_through_lax" },
        });
      });
    });
  },
);
