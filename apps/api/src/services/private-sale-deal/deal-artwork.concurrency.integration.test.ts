import { randomUUID } from "node:crypto";
import {
  ArtworkOfferLock,
  type ArtworkRegisterEntry,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity } from "@auction/db/schema";
import { resolvePrivateSalePolicy } from "@auction/domain";
import {
  DrizzleArtworkRegisterRepository,
  DrizzlePrivateSaleDealQueryRepository,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { seedIdentityUserFixtures } from "../../testing/identity-user-fixtures.js";
import { DealArtworkService } from "./deal-artwork.service.js";
import { recordingSink } from "./deal-fixtures.test-util.js";
import { DealLockLinks } from "./deal-lock-links.js";
import { ArtworkRegisterDealLock } from "./deal-register-lock.js";
import type { DealStaffViewer } from "./deal-staff-permissions.js";
import { DealTransitionService } from "./deal-transition.service.js";

const url = process.env.DATABASE_URL;
const DEAL_TABLES = [
  "private_sale_deal_artwork_history",
  "private_sale_deal_stage_history",
  "private_sale_deal_party_history",
  "private_sale_deal_party",
];
/** Append-only tables these tests write to; each has a guard trigger that refuses DELETE. */
const GUARDED = [
  "private_sale_deal_artwork_history",
  "private_sale_deal_stage_history",
  "private_sale_deal_party_history",
  "artwork_register_event",
];
const t = new Date("2026-11-01T00:00:00Z");
const MANAGER = (userId: string): DealStaffViewer => ({
  userId,
  abilities: { manage: true, finance: false, release: false },
  checks: true,
  scope: { kind: "all" },
});

/**
 * Two people acting at the same moment, on real, committed transactions. The rows these tests
 * write are removed afterwards (see `cleanUp`), so the shared test database is left as it was found.
 */
describe.skipIf(!url)(
  "two people changing deal artworks at once (Postgres)",
  { timeout: 60_000 },
  () => {
    const db = createDb(url as string);
    const run = randomUUID().slice(0, 8);
    const stockRun = run.slice(0, 6).toUpperCase();
    const staffId = `icf-cc-staff-${run}`;
    const sellerUserId = `icf-cc-seller-${run}`;
    const sellerEntityId = randomUUID();
    let counter = 0;
    const artworkIds: string[] = [];
    const dealIds: string[] = [];
    const submissionIds: string[] = [];

    const registers = new DrizzleArtworkRegisterRepository(db);
    const events = recordingSink();
    const lockFor = (executor: Database) =>
      new ArtworkRegisterDealLock<Database>(
        executor,
        (session) =>
          new ArtworkOfferLock(new DrizzleArtworkRegisterRepository(db).withExecutor(session)),
      );
    const scopeForTx = (executor: Database) => ({
      deals: new DrizzlePrivateSaleDealRepository(executor),
      events,
      register: lockFor(executor),
    });
    const transactionRunner = { runInTransaction: (fn: never) => db.transaction(fn) } as never;
    const service = new DealArtworkService({
      deals: new DrizzlePrivateSaleDealRepository(db),
      artworks: registers,
      transactionRunner,
      scopeForTx,
      lockLinks: new DealLockLinks({}, new DrizzlePrivateSaleDealQueryRepository(db)),
      records: { recordOf: async (_v, deal) => ({ reference: deal.reference }) as never },
    });
    const transitions = new DealTransitionService({
      scope: scopeForTx(db),
      inTransaction: { runner: transactionRunner, scopeForTx },
      clearance: { snapshot: async () => ({}) as never },
      policy: resolvePrivateSalePolicy({ commissionRateBps: 1500 }),
    });

    let seeded: Promise<void> | null = null;
    const setup = () => {
      seeded ??= seed();
      return seeded;
    };

    async function seed() {
      await seedIdentityUserFixtures(
        db,
        [staffId, sellerUserId].map((id) => ({
          id,
          name: id,
          email: `${id}@integration.test`,
          createdAt: t,
        })),
      );
      await db.insert(legalEntity).values({
        id: sellerEntityId,
        displayName: "Henry Lowe",
        kind: "organisation",
        subkind: "company",
        createdByUserId: sellerUserId,
        status: "approved",
        createdAt: t,
        updatedAt: t,
      });
    }

    async function newArtwork(): Promise<ArtworkRegisterEntry> {
      counter += 1;
      const id = `${run}-${counter}`;
      const entry: NewArtworkRegisterEntry = {
        zohoProductId: `cc-${id}`,
        stockCode: `LAX-ORI-CC-${stockRun}-26-${String(counter).padStart(4, "0")}`,
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
      artworkIds.push(created.entry.id);
      return created.entry;
    }

    async function newDeal(artworkRegisterId: string | null) {
      const [submission] = await db
        .insert(itemSubmission)
        .values({
          legalEntityId: sellerEntityId,
          title: "Low tide at Maldon",
          status: "approved",
          submittedByUserId: sellerUserId,
        })
        .returning({ id: itemSubmission.id });
      submissionIds.push(submission?.id as string);
      const deal = await new DrizzlePrivateSaleDealRepository(db).create({
        itemSubmissionId: submission?.id as string,
        ...(artworkRegisterId ? { artworkRegisterId } : {}),
        ownerUserId: staffId,
        seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
        buyerFeeBps: 0,
        sellerCommissionBps: 1500,
        actorUserId: staffId,
      });
      dealIds.push(deal.id);
      return deal;
    }

    /**
     * Removes everything this run wrote. The artwork history is append-only, so the guard trigger
     * is switched off for the length of one transaction (nobody else ever sees it off) and back on
     * before it commits. Needs the table owner, as the migrations do.
     */
    async function cleanUp() {
      if (!seeded) return;
      const list = (ids: string[]) =>
        sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`, `,
        );
      await db.transaction(async (tx) => {
        for (const table of GUARDED) {
          await tx.execute(sql`ALTER TABLE ${sql.identifier(table)} DISABLE TRIGGER USER`);
        }
        if (dealIds.length > 0) {
          const deals = list(dealIds);
          for (const table of DEAL_TABLES) {
            await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE deal_id IN (${deals})`);
          }
          await tx.execute(sql`DELETE FROM private_sale_deal WHERE id IN (${deals})`);
        }
        if (submissionIds.length > 0) {
          await tx.execute(sql`DELETE FROM item_submission WHERE id IN (${list(submissionIds)})`);
        }
        if (artworkIds.length > 0) {
          const art = list(artworkIds);
          await tx.execute(sql`DELETE FROM artwork_register_event WHERE register_id IN (${art})`);
          await tx.execute(sql`DELETE FROM artwork_register WHERE id IN (${art})`);
        }
        await tx.execute(sql`DELETE FROM legal_entity WHERE id = ${sellerEntityId}::uuid`);
        await tx.execute(sql`DELETE FROM "user" WHERE id IN (${staffId}, ${sellerUserId})`);
        for (const table of GUARDED) {
          await tx.execute(sql`ALTER TABLE ${sql.identifier(table)} ENABLE TRIGGER USER`);
        }
      });
    }
    afterAll(cleanUp);

    it("same deal, two different artworks: one is kept, the other is told the deal changed", async () => {
      await setup();
      const [a, b] = [await newArtwork(), await newArtwork()];
      const deal = await newDeal(null);
      const results = await Promise.all([
        service.set(MANAGER(staffId), deal.reference, { version: 1, artworkRegisterId: a.id }),
        service.set(MANAGER(staffId), deal.reference, { version: 1, artworkRegisterId: b.id }),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const lost = results.find((r) => !r.ok);
      expect(lost).toMatchObject({ ok: false, error: "stale_version", currentVersion: 2 });

      const kept = (await new DrizzlePrivateSaleDealRepository(db).findById(deal.id))
        ?.artworkRegisterId as string;
      const other = kept === a.id ? b.id : a.id;
      // The winner holds its artwork; the loser's was never held.
      expect((await registers.findById(kept))?.offer.state).toBe("private_sale");
      expect((await registers.findById(other))?.offer.state).toBe("held");
    });

    it("same artwork, two deals: one holds it, the other is refused by the lock", async () => {
      await setup();
      const art = await newArtwork();
      const [first, second] = [await newDeal(null), await newDeal(null)];
      const results = await Promise.all([
        service.set(MANAGER(staffId), first.reference, { version: 1, artworkRegisterId: art.id }),
        service.set(MANAGER(staffId), second.reference, { version: 1, artworkRegisterId: art.id }),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        ok: false,
        error: "artwork_unavailable",
      });
      const held = (await registers.findById(art.id))?.offer;
      expect(held?.state).toBe("private_sale");
      const winner = results[0]?.ok ? first : second;
      expect(held?.ref?.id).toBe(winner.id);
    });

    it("a change racing a cancel never leaves a cancelled deal holding an artwork", async () => {
      await setup();
      const [a, b] = [await newArtwork(), await newArtwork()];
      const deal = await newDeal(a.id);
      await new ArtworkOfferLock(registers).offer(
        { registerId: a.id },
        { kind: "private_sale", id: deal.id },
        "staff:setup",
      );
      await Promise.all([
        service.set(MANAGER(staffId), deal.reference, {
          version: 1,
          artworkRegisterId: b.id,
          reason: "The buyer chose the other study.",
        }),
        transitions.transition(deal.id, "cancel", {
          actorUserId: staffId,
          cancelReason: "The buyer withdrew.",
          expectedVersion: 1,
        }),
      ]);
      const after = await new DrizzlePrivateSaleDealRepository(db).findById(deal.id);
      const heldBy = async (id: string) => (await registers.findById(id))?.offer;
      if (after?.stage === "cancelled") {
        for (const id of [a.id, b.id]) {
          const offer = await heldBy(id);
          expect(offer?.state === "private_sale" && offer.ref?.id === deal.id).toBe(false);
        }
      } else {
        // The change won: the deal is live and holds only the new artwork.
        expect(after?.artworkRegisterId).toBe(b.id);
        expect((await heldBy(b.id))?.ref?.id).toBe(deal.id);
        expect((await heldBy(a.id))?.state).toBe("withdrawn");
      }
    });
  },
);
