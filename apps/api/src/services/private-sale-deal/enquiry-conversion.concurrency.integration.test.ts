import { randomUUID } from "node:crypto";
import { ArtworkOfferLock } from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, marketingEnquiry } from "@auction/db/schema";
import { resolvePrivateSalePolicy } from "@auction/domain";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleDealWorkStore,
  DrizzleItemSubmissionRepository,
  DrizzleMarketingEnquiryRepository,
  DrizzlePrivateSaleDealQueryRepository,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { seedIdentityUserFixtures } from "../../testing/identity-user-fixtures.js";
import { convert as convertToLot } from "../submission/submission-convert-to-lot.js";
import type { ItemSubmissionServiceDeps } from "../submission/submission-types.js";
import { recordingSink } from "./deal-fixtures.test-util.js";
import { DealLockLinks } from "./deal-lock-links.js";
import { ArtworkRegisterDealLock } from "./deal-register-lock.js";
import { EnquiryConversionService } from "./enquiry-conversion.service.js";

const url = process.env.DATABASE_URL;
const t = new Date("2026-11-01T00:00:00Z");
const DEAL_TABLES = [
  "private_sale_deal_artwork_history",
  "private_sale_deal_stage_history",
  "private_sale_deal_party_history",
  "private_sale_deal_party",
];
const GUARDED = [
  "private_sale_deal_artwork_history",
  "private_sale_deal_stage_history",
  "private_sale_deal_party_history",
];

/**
 * A work being sold privately and put into an auction at the same moment, on real, committed
 * transactions. The work is held while the deal is made, so the lot is refused rather than both
 * going ahead. The rows are removed afterwards so the shared test database is left as it was found.
 */
describe.skipIf(!url)(
  "converting one consignment twice at once (Postgres)",
  { timeout: 60_000 },
  () => {
    const db = createDb(url as string);
    const run = randomUUID().slice(0, 8);
    const staffId = `icf-cv-staff-${run}`;
    const sellerUserId = `icf-cv-seller-${run}`;
    const buyerUserId = `icf-cv-buyer-${run}`;
    const sellerEntityId = randomUUID();
    const buyerEntityId = randomUUID();
    const enquiryIds: string[] = [];
    const submissionIds: string[] = [];
    let seeded = false;

    const entityOf = (userId: string) => (userId === buyerUserId ? buyerEntityId : sellerEntityId);

    async function setup() {
      if (seeded) return;
      await seedIdentityUserFixtures(
        db,
        [staffId, sellerUserId, buyerUserId].map((id) => ({
          id,
          name: id,
          email: `${id}@integration.test`,
          createdAt: t,
        })),
      );
      for (const [id, owner] of [
        [sellerEntityId, sellerUserId],
        [buyerEntityId, buyerUserId],
      ] as const) {
        await db.insert(legalEntity).values({
          id,
          displayName: `Convert ${id.slice(0, 4)}`,
          kind: "organisation",
          subkind: "company",
          createdByUserId: owner,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
      }
      seeded = true;
    }

    async function newWork(): Promise<{ id: string; reference: string }> {
      const [row] = await db
        .insert(itemSubmission)
        .values({
          legalEntityId: sellerEntityId,
          title: "Race work",
          status: "approved",
          submittedByUserId: sellerUserId,
        })
        .returning({ id: itemSubmission.id, ref: itemSubmission.referenceNumber });
      if (!row) throw new Error("work not created");
      submissionIds.push(row.id);
      return { id: row.id, reference: `C-${row.ref}` };
    }

    async function newBuyEnquiry(): Promise<string> {
      const [row] = await db
        .insert(marketingEnquiry)
        .values({
          intent: "private_sale_buy",
          topic: "buying",
          name: "Buyer",
          email: "buyer@example.com",
          message: "Interested",
          status: "in_progress",
          assignedToUserId: staffId,
          userId: buyerUserId,
          legalEntityId: buyerEntityId,
        })
        .returning({ id: marketingEnquiry.id, reference: marketingEnquiry.reference });
      if (!row) throw new Error("enquiry not created");
      enquiryIds.push(row.id);
      return row.reference;
    }

    /** A conversion service whose deal insert can be paused while the work is held. */
    function dealConversion(pause?: { reached: () => void; release: Promise<void> }) {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const registers = new DrizzleArtworkRegisterRepository(db);
      return new EnquiryConversionService({
        enquiries: new DrizzleMarketingEnquiryRepository(db),
        works: new DrizzleDealWorkStore(db),
        openDeals: queries,
        dealsForTx: (executor) => {
          const deals = new DrizzlePrivateSaleDealRepository(executor);
          return {
            create: async (input) => {
              pause?.reached();
              await pause?.release;
              return deals.create(input);
            },
          };
        },
        artworks: registers,
        lockLinks: new DealLockLinks({}, queries),
        registerForTx: (executor) =>
          new ArtworkRegisterDealLock<Database>(
            executor,
            (session) =>
              new ArtworkOfferLock(new DrizzleArtworkRegisterRepository(db).withExecutor(session)),
          ),
        parties: {
          resolve: async ({ userId }: { userId: string }) => ({
            legalEntityId: entityOf(userId),
            actingUserId: userId,
          }),
        } as never,
        policy: resolvePrivateSalePolicy({ commissionRateBps: 1500 }),
        transactionRunner: { runInTransaction: (fn: never) => db.transaction(fn) } as never,
        events: recordingSink(),
      });
    }

    const lotDeps = (): ItemSubmissionServiceDeps =>
      ({
        transactionRunner: { runInTransaction: (fn: never) => db.transaction(fn) },
        submissions: new DrizzleItemSubmissionRepository(db),
        privateSaleDeals: new DrizzlePrivateSaleDealQueryRepository(db),
        repoFactory: {
          forTransaction: (tx: Database) => ({
            itemSubmission: new DrizzleItemSubmissionRepository(tx),
            // Reached only if the work was not held: the lot is never really written.
            lot: { create: async () => ({ id: randomUUID() }) },
          }),
        },
        consignmentAgreements: null,
        lotLifecycleRecording: null,
        legalEntityNotificationRecipients: null,
        dispatcher: { dispatch: async () => undefined },
      }) as never;

    const VIEWER = { userId: staffId, readsPrivateSale: true };
    const stillWaiting = (p: Promise<unknown>) =>
      Promise.race([
        p.then(() => false),
        new Promise<boolean>((r) => setTimeout(() => r(true), 500)),
      ]);

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
        if (submissionIds.length > 0) {
          const works = list(submissionIds);
          const deals = sql`(SELECT id FROM private_sale_deal WHERE item_submission_id IN (${works}))`;
          for (const table of DEAL_TABLES) {
            await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE deal_id IN ${deals}`);
          }
          await tx.execute(
            sql`DELETE FROM private_sale_deal WHERE item_submission_id IN (${works})`,
          );
          await tx.execute(sql`DELETE FROM item_submission WHERE id IN (${works})`);
        }
        for (const table of GUARDED) {
          await tx.execute(sql`ALTER TABLE ${sql.identifier(table)} ENABLE TRIGGER USER`);
        }
        if (enquiryIds.length > 0) {
          await tx.delete(marketingEnquiry).where(eq(marketingEnquiry.userId, buyerUserId));
        }
        await tx.execute(
          sql`DELETE FROM legal_entity WHERE id IN (${sellerEntityId}::uuid, ${buyerEntityId}::uuid)`,
        );
        await tx.execute(
          sql`DELETE FROM "user" WHERE id IN (${staffId}, ${sellerUserId}, ${buyerUserId})`,
        );
      });
    }
    afterAll(cleanUp);

    it("refuses the lot while a private sale is being made for the same work", async () => {
      await setup();
      const work = await newWork();
      const ref = await newBuyEnquiry();
      let reached = () => {};
      const atCreate = new Promise<void>((r) => {
        reached = r;
      });
      let release = () => {};
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const deal = dealConversion({ reached, release: gate }).convert(VIEWER, ref, {
        workReference: work.reference,
        notInRegister: { reason: "sellers_own_work" },
      });
      await atCreate;

      const lot = convertToLot(lotDeps(), staffId, work.id);
      // The deal holds the work, so the lot has to wait for it.
      expect(await stillWaiting(lot)).toBe(true);
      release();

      expect(await deal).toMatchObject({ ok: true });
      const lotResult = await lot;
      expect(lotResult.isErr()).toBe(true);
      expect(lotResult._unsafeUnwrapErr()).toMatchObject({
        status: 409,
        message: expect.stringMatching(/private sale/),
      });
      const [row] = await db
        .select({ status: itemSubmission.status, lot: itemSubmission.convertedLotId })
        .from(itemSubmission)
        .where(eq(itemSubmission.id, work.id));
      expect(row).toEqual({ status: "approved", lot: null });
    });

    it("lets only one of two private sales through for the same work", async () => {
      await setup();
      const work = await newWork();
      const [a, b] = [await newBuyEnquiry(), await newBuyEnquiry()];
      const input = {
        workReference: work.reference,
        notInRegister: { reason: "sellers_own_work" },
      } as const;
      const results = await Promise.all([
        dealConversion().convert(VIEWER, a, input),
        dealConversion().convert(VIEWER, b, input),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/^work_in_deal$|^work_not_available$/),
      });
    });
  },
);
