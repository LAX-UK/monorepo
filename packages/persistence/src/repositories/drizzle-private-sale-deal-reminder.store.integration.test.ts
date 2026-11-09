import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, privateSaleDeal, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzlePrivateSaleDealReminderStore } from "./drizzle-private-sale-deal-reminder.store.js";
import { DrizzlePrivateSaleDealRepository } from "./drizzle-private-sale-deal.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("private sale deal reminders (integration)", () => {
  const sellerUserId = "psr-it-seller";
  const buyerUserId = "psr-it-buyer";
  const sellerEntityId = "a0e00000-0000-4000-8000-0000000000b1";
  const buyerEntityId = "a0e00000-0000-4000-8000-0000000000b2";
  const t = new Date("2026-10-01T00:00:00Z");
  const due = new Date("2026-11-20T23:59:59Z");

  async function inRollback(run: (db: Database, dealId: string) => Promise<void>) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_private_sale_reminder_test");
    try {
      await db.transaction(async (tx) => {
        for (const id of [sellerUserId, buyerUserId]) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }
        for (const [id, name, owner] of [
          [sellerEntityId, "Henry Lowe", sellerUserId],
          [buyerEntityId, "Marlow Collection Ltd", buyerUserId],
        ] as const) {
          await tx.insert(legalEntity).values({
            id,
            displayName: name,
            kind: "organisation",
            subkind: "company",
            createdByUserId: owner,
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
        }
        const [submission] = await tx
          .insert(itemSubmission)
          .values({
            legalEntityId: sellerEntityId,
            title: "Low tide at Maldon",
            status: "draft",
            submittedByUserId: sellerUserId,
          })
          .returning({ id: itemSubmission.id });
        const deal = await new DrizzlePrivateSaleDealRepository(tx as unknown as Database).create({
          itemSubmissionId: submission?.id as string,
          ownerUserId: sellerUserId,
          seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
          buyer: { legalEntityId: buyerEntityId, actingUserId: buyerUserId },
          buyerFeeBps: 250,
          sellerCommissionBps: 1500,
          actorUserId: sellerUserId,
        });
        await run(tx as unknown as Database, deal.id);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  /** Moves the deal to a stage with everything the database requires of that stage. */
  const moveTo = (
    db: Database,
    dealId: string,
    stage: "agreed" | "invoiced" | "paid" | "released",
    extra: Partial<typeof privateSaleDeal.$inferInsert> = {},
  ) =>
    db
      .update(privateSaleDeal)
      .set({
        stage,
        priceMinor: 4_000_000,
        agreedAt: t,
        vatTreatment: "margin_scheme",
        sellerCommissionBps: 1500,
        paymentDueAt: due,
        ...extra,
      })
      .where(eq(privateSaleDeal.id, dealId));

  it("lists an invoiced deal for its payment deadline with what the buyer owes", async () => {
    await inRollback(async (db, dealId) => {
      await moveTo(db, dealId, "invoiced");
      const [candidate] = await new DrizzlePrivateSaleDealReminderStore(db).listCandidates(10);
      expect(candidate).toMatchObject({
        dealId,
        kind: "payment",
        stage: "invoiced",
        dueAt: due,
        buyerLegalEntityId: buyerEntityId,
        buyerUserId,
        workTitle: "Low tide at Maldon",
        amountDueMinor: 4_100_000,
        sentSteps: [],
      });
    });
  });

  it("lists a paid deal for its collection deadline, and nothing for other stages", async () => {
    await inRollback(async (db, dealId) => {
      const store = new DrizzlePrivateSaleDealReminderStore(db);
      await moveTo(db, dealId, "agreed", { collectionDueAt: due });
      expect(await store.listCandidates(10)).toEqual([]);
      await moveTo(db, dealId, "paid", { collectionDueAt: due });
      const found = await store.listCandidates(10);
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ dealId, kind: "collection", stage: "paid" });
      await moveTo(db, dealId, "released", { collectionDueAt: due });
      expect(await store.listCandidates(10)).toEqual([]);
    });
  });

  it("gives each step to one run only, shows what was sent, and takes a step back", async () => {
    await inRollback(async (db, dealId) => {
      const store = new DrizzlePrivateSaleDealReminderStore(db);
      await moveTo(db, dealId, "invoiced");
      expect(await store.claim(dealId, "payment", "before_due")).toBe(true);
      expect(await store.claim(dealId, "payment", "before_due")).toBe(false);
      expect(await store.claim(dealId, "collection", "before_due")).toBe(true);
      const [candidate] = await store.listCandidates(10);
      expect(candidate?.sentSteps).toEqual(["before_due"]);
      await store.release(dealId, "payment", "before_due");
      expect(await store.claim(dealId, "payment", "before_due")).toBe(true);
    });
  });
});
