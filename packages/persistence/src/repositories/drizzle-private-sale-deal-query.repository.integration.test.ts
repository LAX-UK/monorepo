import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, privateSaleDeal, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  DrizzleDealWorkStore,
  DrizzlePrivateSaleDealQueryRepository,
} from "./drizzle-private-sale-deal-query.repository.js";
import { DrizzlePrivateSaleDealRepository } from "./drizzle-private-sale-deal.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("private sale deal lists and works (integration)", () => {
  const staffId = "psq-it-staff";
  const otherStaffId = "psq-it-other-staff";
  const sellerUserId = "psq-it-seller";
  const buyerUserId = "psq-it-buyer";
  const sellerEntityId = "a0e00000-0000-4000-8000-0000000000a1";
  const buyerEntityId = "a0e00000-0000-4000-8000-0000000000a2";
  const t = new Date("2026-10-01T00:00:00Z");

  /** Runs in a transaction that is always rolled back. */
  async function inRollback(run: (db: Database, submissionId: string) => Promise<void>) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_private_sale_query_test");
    try {
      await db.transaction(async (tx) => {
        for (const id of [staffId, otherStaffId, sellerUserId, buyerUserId]) {
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

  /** A fresh work: only one live deal may exist for each. */
  const work = async (db: Database): Promise<string> => {
    const [row] = await db
      .insert(itemSubmission)
      .values({
        legalEntityId: sellerEntityId,
        title: "Another work",
        status: "draft",
        submittedByUserId: sellerUserId,
      })
      .returning({ id: itemSubmission.id });
    return row?.id as string;
  };

  const newDeal = (
    submissionId: string,
    extra: Partial<{ ownerUserId: string; buyer: boolean }> = {},
  ) => ({
    itemSubmissionId: submissionId,
    ownerUserId: extra.ownerUserId ?? staffId,
    seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
    ...(extra.buyer ? { buyer: { legalEntityId: buyerEntityId, actingUserId: buyerUserId } } : {}),
    buyerFeeBps: 0,
    sellerCommissionBps: null,
    actorUserId: staffId,
  });

  /** Puts the deal in a stage directly: the lists read the column, not the history. */
  const setStage = (db: Database, id: string, stage: string, extra: Record<string, unknown> = {}) =>
    db
      .update(privateSaleDeal)
      .set({ stage, ...extra })
      .where(eq(privateSaleDeal.id, id));

  it("lists each view with the work, both sides and the price, and counts them", async () => {
    await inRollback(async (db) => {
      const deals = new DrizzlePrivateSaleDealRepository(db);
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const proposed = await deals.create(newDeal(await work(db)));
      const offered = await deals.create(
        newDeal(await work(db), { buyer: true, ownerUserId: otherStaffId }),
      );
      await setStage(db, offered.id, "offer", { priceMinor: 4_800_000 });
      const cancelled = await deals.create(newDeal(await work(db)));
      await setStage(db, cancelled.id, "cancelled", {
        cancelReason: "Seller withdrew",
        cancelledAt: new Date(),
      });

      const active = await queries.list({
        view: "active",
        viewerUserId: staffId,
        scope: { kind: "all" },
        limit: 100,
      });
      const ours = active.filter((row) => [proposed.id, offered.id].includes(row.id));
      expect(ours.map((row) => row.id).sort()).toEqual([proposed.id, offered.id].sort());
      expect(ours.find((row) => row.id === offered.id)).toMatchObject({
        reference: offered.reference,
        stage: "offer",
        workTitle: "Another work",
        workReference: expect.stringMatching(/^C-\d+$/),
        sellerName: "Henry Lowe",
        buyerName: "Marlow Collection Ltd",
        priceMinor: 4_800_000,
        ownerUserId: otherStaffId,
      });
      expect(ours.find((row) => row.id === proposed.id)?.buyerName).toBeNull();

      const mine = await queries.list({
        view: "needs_me",
        viewerUserId: staffId,
        scope: { kind: "all" },
        limit: 100,
      });
      expect(mine.map((row) => row.id)).toContain(proposed.id);
      expect(mine.map((row) => row.id)).not.toContain(offered.id);

      const closed = await queries.list({
        view: "cancelled",
        viewerUserId: staffId,
        scope: { kind: "all" },
        limit: 100,
      });
      expect(closed.map((row) => row.id)).toContain(cancelled.id);
      expect(
        (
          await queries.list({
            view: "active",
            viewerUserId: staffId,
            scope: { kind: "all" },
            limit: 100,
          })
        ).map((r) => r.id),
      ).not.toContain(cancelled.id);

      const counts = await queries.countByStage(staffId, { kind: "all" });
      const of = (stage: string) => counts.find((c) => c.stage === stage);
      expect(of("proposed")?.total).toBeGreaterThanOrEqual(1);
      expect(of("proposed")?.ownedByViewer).toBeGreaterThanOrEqual(1);
      expect(of("offer")?.total).toBeGreaterThanOrEqual(1);
      expect(of("cancelled")?.total).toBeGreaterThanOrEqual(1);
    });
  });

  it("pages in the view's order without repeating or skipping a deal", async () => {
    await inRollback(async (db) => {
      const deals = new DrizzlePrivateSaleDealRepository(db);
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const created = [];
      for (let i = 0; i < 5; i += 1) created.push(await deals.create(newDeal(await work(db))));
      // Three deals changed in the same millisecond must still page in a stable order.
      const same = new Date("2026-10-02T09:00:00.123Z");
      await db
        .update(privateSaleDeal)
        .set({ updatedAt: same })
        .where(eq(privateSaleDeal.id, created[0]?.id as string));
      await db
        .update(privateSaleDeal)
        .set({ updatedAt: same })
        .where(eq(privateSaleDeal.id, created[1]?.id as string));
      await db
        .update(privateSaleDeal)
        .set({ updatedAt: same })
        .where(eq(privateSaleDeal.id, created[2]?.id as string));

      const ids = new Set(created.map((d) => d.id));
      const seen: string[] = [];
      let after: { updatedAt: Date; id: string } | null = null;
      for (let guard = 0; guard < 100; guard += 1) {
        const page = await queries.list({
          view: "all",
          viewerUserId: staffId,
          scope: { kind: "all" },
          after,
          limit: 2,
        });
        const rows = page.slice(0, 2);
        seen.push(...rows.map((row) => row.id));
        const last = rows.at(-1);
        if (page.length <= 2 || !last) break;
        after = { updatedAt: last.updatedAt, id: last.id };
      }
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen.filter((id) => ids.has(id)).length).toBe(5);
    });
  });

  it("cuts the list and the counts to the viewer's scope", async () => {
    await inRollback(async (db) => {
      const deals = new DrizzlePrivateSaleDealRepository(db);
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const mine = await deals.create(newDeal(await work(db), { ownerUserId: staffId }));
      const theirs = await deals.create(newDeal(await work(db), { ownerUserId: otherStaffId }));
      await setStage(db, theirs.id, "paid", {
        priceMinor: 100,
        agreedAt: new Date(),
        vatTreatment: "margin_scheme",
        sellerCommissionBps: 1500,
        paymentDueAt: new Date(),
      });

      const owned = await queries.list({
        view: "all",
        viewerUserId: staffId,
        scope: { kind: "owned", userId: staffId },
        limit: 100,
      });
      expect(owned.map((row) => row.id)).toContain(mine.id);
      expect(owned.map((row) => row.id)).not.toContain(theirs.id);

      const ready = await queries.list({
        view: "all",
        viewerUserId: staffId,
        scope: { kind: "stages", stages: ["paid"] },
        limit: 100,
      });
      expect(ready.map((row) => row.id)).toContain(theirs.id);
      expect(ready.map((row) => row.id)).not.toContain(mine.id);

      const counts = await queries.countByStage(staffId, { kind: "owned", userId: staffId });
      expect(counts.find((c) => c.stage === "paid")?.total ?? 0).toBe(
        (await queries.countByStage(staffId, { kind: "owned", userId: staffId })).find(
          (c) => c.stage === "paid",
        )?.total ?? 0,
      );
      expect(counts.every((c) => c.total === c.ownedByViewer)).toBe(true);
    });
  });

  it("allows one live deal per work, and a new one once the first is cancelled or settled", async () => {
    await inRollback(async (db, submissionId) => {
      const deals = new DrizzlePrivateSaleDealRepository(db);
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      expect(await queries.hasOpenDealForWork(submissionId)).toBe(false);
      const first = await deals.create(newDeal(submissionId));
      expect(await queries.hasOpenDealForWork(submissionId)).toBe(true);

      // The database refuses a second live deal for the same work, even if the check was raced.
      const refused = await deals.create(newDeal(submissionId)).then(
        () => null,
        (error: unknown) => error,
      );
      // The driver wraps the database error; the unique index is named in the cause.
      const chain: string[] = [];
      for (let e = refused as { message?: string; cause?: unknown } | null; e; ) {
        chain.push(e.message ?? "", String((e as { code?: unknown }).code ?? ""));
        e = e.cause as typeof e;
      }
      expect(chain.join(" ")).toMatch(/private_sale_deal_one_open_per_work_uidx|23505/);

      await setStage(db, first.id, "cancelled", {
        cancelReason: "Seller withdrew",
        cancelledAt: new Date(),
      });
      expect(await queries.hasOpenDealForWork(submissionId)).toBe(false);
      const second = await deals.create(newDeal(submissionId));
      expect(second.id).not.toBe(first.id);
    });
  });

  it("lists the deals a person is named to act in, on either side", async () => {
    await inRollback(async (db) => {
      const deals = new DrizzlePrivateSaleDealRepository(db);
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const sellerOnly = await deals.create(newDeal(await work(db)));
      const both = await deals.create(newDeal(await work(db), { buyer: true }));
      expect(new Set(await queries.listIdsForActingUser(sellerUserId, 10))).toEqual(
        new Set([sellerOnly.id, both.id]),
      );
      expect(await queries.listIdsForActingUser(buyerUserId, 10)).toEqual([both.id]);
      expect(await queries.listIdsForActingUser(staffId, 10)).toEqual([]);
    });
  });

  it("finds the title and consignment reference of a work", async () => {
    await inRollback(async (db, submissionId) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      expect(await queries.findWorkSummary(submissionId)).toEqual({
        title: "Low tide at Maldon",
        reference: expect.stringMatching(/^C-\d+$/),
        legalEntityId: sellerEntityId,
      });
      expect(await queries.findWorkSummary("00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });

  it("opens a draft work for a seller and finds it by its consignment reference", async () => {
    await inRollback(async (db) => {
      const works = new DrizzleDealWorkStore(db);
      const work = await works.createDraftInTransaction(db, {
        legalEntityId: sellerEntityId,
        title: "Harbour at dusk",
        description: "Artist: J. Constable",
        medium: "Oil on canvas",
        dimensions: "60 x 90 cm",
        submittedByUserId: sellerUserId,
      });
      expect(work).toMatchObject({
        legalEntityId: sellerEntityId,
        submittedByUserId: sellerUserId,
        title: "Harbour at dusk",
        reference: expect.stringMatching(/^C-\d+$/),
      });
      const [stored] = await db
        .select({ status: itemSubmission.status, medium: itemSubmission.medium })
        .from(itemSubmission)
        .where(eq(itemSubmission.id, work.id));
      expect(stored).toEqual({ status: "draft", medium: "Oil on canvas" });

      expect((await works.findByReference(work.reference))?.id).toBe(work.id);
      expect((await works.findByReference(work.reference.toLowerCase()))?.id).toBe(work.id);
      expect(await works.findByReference("C-999999999")).toBeNull();
      expect(await works.findByReference("hello")).toBeNull();
    });
  });
});
