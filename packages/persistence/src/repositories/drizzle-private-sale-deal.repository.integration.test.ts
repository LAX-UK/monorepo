import { type Database, createDb } from "@auction/db";
import {
  itemSubmission,
  legalEntity,
  privateSaleDeal,
  privateSaleDealStageHistory,
  user,
} from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzlePrivateSaleDealRepository } from "./drizzle-private-sale-deal.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("private sale deals (integration)", () => {
  const staffId = "psd-it-staff";
  const sellerUserId = "psd-it-seller";
  const buyerUserId = "psd-it-buyer";
  const sellerEntityId = "a0d00000-0000-4000-8000-0000000000a1";
  const buyerEntityId = "a0d00000-0000-4000-8000-0000000000a2";
  const t = new Date("2026-10-01T00:00:00Z");

  /** Runs in a transaction that is always rolled back. */
  async function inRollback(run: (db: Database, submissionId: string) => Promise<void>) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_private_sale_deal_test");
    try {
      await db.transaction(async (tx) => {
        for (const id of [staffId, sellerUserId, buyerUserId]) {
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
        await run(tx as unknown as Database, submission?.id as string);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  const newDeal = (submissionId: string, extra: Record<string, unknown> = {}) => ({
    itemSubmissionId: submissionId,
    ownerUserId: staffId,
    seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
    buyerFeeBps: 0,
    sellerCommissionBps: null,
    actorUserId: staffId,
    ...extra,
  });

  it("opens a proposed deal with a PS reference, its seller and the first history row", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      expect(deal.reference).toMatch(/^PS-\d{4,}$/);
      expect(deal).toMatchObject({
        stage: "proposed",
        buyer: null,
        priceMinor: null,
        buyerFeeBps: 0,
        sellerCommissionBps: null,
        partiesDisclosed: false,
        artworkRegisterId: null,
        version: 1,
        seller: { legalEntityId: sellerEntityId, displayName: "Henry Lowe" },
      });
      expect(await repo.history(deal.id)).toMatchObject([
        { fromStage: null, toStage: "proposed", actorUserId: staffId },
      ]);
      expect((await repo.findByReference(deal.reference))?.id).toBe(deal.id);
      expect(await repo.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });

  it("points at the artwork register when it is given and does not need it", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const withRegister = await repo.create(newDeal(submissionId, { artworkRegisterId: "AR-77" }));
      expect(withRegister.artworkRegisterId).toBe("AR-77");
      const without = await repo.create(newDeal(submissionId));
      expect(without.artworkRegisterId).toBeNull();
    });
  });

  it("names, then replaces, the buyer, and refuses a stale write", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const named = await repo.setParty(deal.id, 1, {
        role: "buyer",
        legalEntityId: buyerEntityId,
        actingUserId: buyerUserId,
      });
      expect(named).toMatchObject({
        kind: "ok",
        deal: { version: 2, buyer: { legalEntityId: buyerEntityId } },
      });
      expect(
        await repo.setParty(deal.id, 1, {
          role: "buyer",
          legalEntityId: sellerEntityId,
          actingUserId: null,
        }),
      ).toEqual({ kind: "conflict" });
      expect(
        await repo.setParty("00000000-0000-4000-8000-000000000000", 1, {
          role: "buyer",
          legalEntityId: buyerEntityId,
          actingUserId: null,
        }),
      ).toEqual({ kind: "not_found" });
    });
  });

  it("changes terms under optimistic concurrency", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const updated = await repo.updateTerms(deal.id, 1, {
        priceMinor: 4_800_000,
        sellerCommissionBps: 1500,
        costsMinor: 35_000,
        vatTreatment: "margin_scheme",
        partiesDisclosed: true,
      });
      expect(updated).toMatchObject({
        kind: "ok",
        deal: {
          version: 2,
          priceMinor: 4_800_000,
          sellerCommissionBps: 1500,
          costsMinor: 35_000,
          vatTreatment: "margin_scheme",
          partiesDisclosed: true,
        },
      });
      expect(await repo.updateTerms(deal.id, 1, { costsMinor: 1 })).toEqual({ kind: "conflict" });
    });
  });

  it("applies a stage change with its fields and appends the history in one step", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      await repo.setParty(deal.id, 1, {
        role: "buyer",
        legalEntityId: buyerEntityId,
        actingUserId: buyerUserId,
      });
      await repo.updateTerms(deal.id, 2, { priceMinor: 4_800_000 });
      const toOffer = await repo.applyStageChange(deal.id, 3, {
        from: "proposed",
        to: "offer",
        actorUserId: staffId,
        reason: null,
        changes: {},
      });
      expect(toOffer).toMatchObject({ kind: "ok", deal: { stage: "offer", version: 4 } });
      const agreedAt = new Date("2026-11-03T10:00:00Z");
      const agreed = await repo.applyStageChange(deal.id, 4, {
        from: "offer",
        to: "agreed",
        actorUserId: staffId,
        reason: null,
        changes: { agreedAt, agreedByUserId: staffId },
      });
      expect(agreed).toMatchObject({
        kind: "ok",
        deal: { stage: "agreed", agreedAt, agreedByUserId: staffId, version: 5 },
      });
      const history = await repo.history(deal.id);
      expect(history.map((h) => [h.fromStage, h.toStage])).toEqual([
        [null, "proposed"],
        ["proposed", "offer"],
        ["offer", "agreed"],
      ]);
    });
  });

  it("refuses a stage change from a stage the deal has left, and writes no history for it", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const result = await repo.applyStageChange(deal.id, 1, {
        from: "offer",
        to: "agreed",
        actorUserId: staffId,
        reason: null,
        changes: {},
      });
      expect(result).toEqual({ kind: "conflict" });
      expect(await repo.history(deal.id)).toHaveLength(1);
    });
  });

  it("records a cancel with its reason", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const at = new Date("2026-11-03T12:00:00Z");
      const result = await repo.applyStageChange(deal.id, 1, {
        from: "proposed",
        to: "cancelled",
        actorUserId: staffId,
        reason: "Seller withdrew the work",
        changes: { cancelReason: "Seller withdrew the work", cancelledAt: at },
      });
      expect(result).toMatchObject({
        kind: "ok",
        deal: { stage: "cancelled", cancelReason: "Seller withdrew the work" },
      });
      expect((await repo.history(deal.id)).at(-1)?.reason).toBe("Seller withdrew the work");
    });
  });

  it("keeps terms acceptances once per party and version", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const input = {
        dealId: deal.id,
        kind: "terms" as const,
        legalEntityId: sellerEntityId,
        version: "v1",
        userId: sellerUserId,
        at: new Date("2026-11-03T09:00:00Z"),
      };
      const first = await repo.recordAcceptance(input);
      const again = await repo.recordAcceptance({ ...input, at: new Date("2026-11-04T09:00:00Z") });
      expect(again.id).toBe(first.id);
      expect(again.acceptedAt).toEqual(input.at);
      await repo.recordAcceptance({ ...input, version: "v2" });
      const loaded = await repo.findById(deal.id);
      expect(loaded?.documents.map((d) => d.version)).toEqual(["v1", "v2"]);
    });
  });

  it("adds a document reference visible only to the audience it names", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const doc = await repo.add({
        dealId: deal.id,
        kind: "condition_report",
        audience: "staff",
        legalEntityId: null,
        version: null,
        uploadObjectId: null,
        createdByUserId: staffId,
      });
      expect(doc).toMatchObject({ kind: "condition_report", audience: "staff", acceptedAt: null });
    });
  });

  it("holds the rules in the database too", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const attempt = (change: () => Promise<unknown>) =>
        expect(db.transaction(async () => change())).rejects.toThrow();

      // Agreed needs a price, and a cancelled deal needs a reason.
      await attempt(() =>
        db.update(privateSaleDeal).set({ stage: "agreed" }).where(eq(privateSaleDeal.id, deal.id)),
      );
      await attempt(() =>
        db
          .update(privateSaleDeal)
          .set({ stage: "cancelled" })
          .where(eq(privateSaleDeal.id, deal.id)),
      );
      // Invoiced needs a VAT treatment, a commission and a payment date.
      await attempt(() =>
        db
          .update(privateSaleDeal)
          .set({ stage: "invoiced", priceMinor: 1000, agreedAt: t })
          .where(eq(privateSaleDeal.id, deal.id)),
      );
      await attempt(() =>
        db.update(privateSaleDeal).set({ priceMinor: 0 }).where(eq(privateSaleDeal.id, deal.id)),
      );
      await attempt(() =>
        db
          .update(privateSaleDeal)
          .set({ buyerFeeBps: 10_001 })
          .where(eq(privateSaleDeal.id, deal.id)),
      );
    });
  });

  it("refuses to change or delete stage history, except clearing a deleted user", async () => {
    await inRollback(async (db, submissionId) => {
      const repo = new DrizzlePrivateSaleDealRepository(db);
      const deal = await repo.create(newDeal(submissionId));
      const attempt = (change: () => Promise<unknown>) =>
        expect(db.transaction(async () => change())).rejects.toThrow(/append-only/);
      await attempt(() =>
        db
          .update(privateSaleDealStageHistory)
          .set({ toStage: "agreed" })
          .where(eq(privateSaleDealStageHistory.dealId, deal.id)),
      );
      await attempt(() =>
        db
          .update(privateSaleDealStageHistory)
          .set({ reason: "rewritten" })
          .where(eq(privateSaleDealStageHistory.dealId, deal.id)),
      );
      await attempt(() =>
        db
          .delete(privateSaleDealStageHistory)
          .where(eq(privateSaleDealStageHistory.dealId, deal.id)),
      );
      // Deleting the person who acted clears the actor and keeps the row.
      await db.execute(sql`DELETE FROM "user" WHERE id = ${staffId}`);
      const [row] = await db
        .select()
        .from(privateSaleDealStageHistory)
        .where(eq(privateSaleDealStageHistory.dealId, deal.id));
      expect(row).toMatchObject({ toStage: "proposed", actorUserId: null });
    });
  });
});
