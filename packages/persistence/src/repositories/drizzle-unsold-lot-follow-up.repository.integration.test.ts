import { type Database, createDb } from "@auction/db";
import {
  itemSubmission,
  legalEntity,
  lot,
  unsoldChoiceDeadline,
  unsoldLotChoice,
  unsoldLotFollowUp,
  user,
} from "@auction/db/schema";
import type { UnsoldLotChoiceKind } from "@auction/types";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAdminWorkItemsReader } from "./drizzle-admin-work-items.reader.js";
import { DrizzleLotTransitionGuardReader } from "./drizzle-lot-transition-guard.reader.js";
import { DrizzleUnsoldLotFollowUpRepository } from "./drizzle-unsold-lot-follow-up.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("unsold lot follow-up (integration)", () => {
  const ownerId = "uofu-it-owner";
  const staffId = "uofu-it-staff";
  const entityId = "a0d00000-0000-4000-8000-000000000001";
  const t = new Date("2026-10-01T00:00:00Z");
  const ended = new Date("2026-10-20T18:00:00Z");
  const now = new Date("2026-11-20T09:00:00Z");

  async function inRollback(run: (db: Database) => Promise<void>) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_unsold_follow_up_test");
    try {
      await db.transaction(async (tx) => {
        for (const id of [ownerId, staffId]) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }
        await tx.insert(legalEntity).values({
          id: entityId,
          displayName: "Northbank Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: ownerId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await run(tx as unknown as Database);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  /** A consigned lot that ended unsold with a confirmed choice. */
  async function confirmed(
    db: Database,
    input: { choice: UnsoldLotChoiceKind; reserve?: string | null; title?: string },
  ) {
    const [created] = await db
      .insert(lot)
      .values({
        sellerLegalEntityId: entityId,
        title: input.title ?? "Harbour at Dusk",
        auctionType: "english",
        startingPrice: "100.00",
        currentPrice: "100.00",
        reservePrice: "5000.00",
        startTime: new Date(ended.getTime() - 86_400_000),
        endTime: ended,
        status: "ended",
      })
      .returning({ id: lot.id });
    const lotId = created?.id as string;
    const [submission] = await db
      .insert(itemSubmission)
      .values({
        legalEntityId: entityId,
        title: input.title ?? "Harbour at Dusk",
        status: "converted",
        convertedLotId: lotId,
        submittedByUserId: ownerId,
      })
      .returning({ id: itemSubmission.id });
    const submissionId = submission?.id as string;
    const [choice] = await db
      .insert(unsoldLotChoice)
      .values({
        lotId,
        submissionId,
        legalEntityId: entityId,
        lotEndTime: ended,
        status: "confirmed",
        decidedChoice: input.choice,
        decidedReserve: input.reserve ?? null,
        decidedByUserId: staffId,
        decidedAt: t,
      })
      .returning({ id: unsoldLotChoice.id });
    return { lotId, submissionId, choiceId: choice?.id as string };
  }

  it("opens the work once per confirmed choice, carrying the agreed reserve only for a relist", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleUnsoldLotFollowUpRepository(db);
      const relist = await confirmed(db, { choice: "relist", reserve: "4200.00" });
      const first = await repo.openForConfirmedChoice(relist.submissionId, relist.lotId);
      const again = await repo.openForConfirmedChoice(relist.submissionId, relist.lotId);
      expect(first).toMatchObject({ kind: "relist", reserve: "4200.00", status: "open" });
      expect(again?.id).toBe(first?.id);
      expect(await db.select().from(unsoldLotFollowUp)).toHaveLength(1);

      const collect = await confirmed(db, { choice: "collect", reserve: "1.00", title: "Other" });
      expect(await repo.openForConfirmedChoice(collect.submissionId, collect.lotId)).toMatchObject({
        kind: "collect",
        reserve: null,
      });
    });
  });

  it("opens nothing for an outcome the lot has moved on from", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleUnsoldLotFollowUpRepository(db);
      const { lotId, submissionId } = await confirmed(db, { choice: "relist" });
      await db
        .update(lot)
        .set({ endTime: new Date("2026-11-10T18:00:00Z") })
        .where(eq(lot.id, lotId));
      expect(await repo.openForConfirmedChoice(submissionId, lotId)).toBeNull();
    });
  });

  it("puts the agreed reserve on the lot once, when it returns to inventory", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleUnsoldLotFollowUpRepository(db);
      const { lotId, submissionId } = await confirmed(db, { choice: "relist", reserve: "4200.00" });
      await repo.openForConfirmedChoice(submissionId, lotId);

      const settled = await repo.settleOnReturn(db, { lotId, lotEndTime: ended }, staffId, now);
      expect(settled).toMatchObject({ previousReserve: "5000.00", appliedReserve: "4200.00" });
      const [after] = await db.select().from(lot).where(eq(lot.id, lotId));
      expect(after?.reservePrice).toBe("4200.00");
      expect(await repo.findForOutcome({ lotId, lotEndTime: ended })).toMatchObject({
        status: "done",
        completedByUserId: staffId,
        reserveAppliedAt: now,
      });

      // The reserve is not applied a second time, even if someone changed it in between.
      await db.update(lot).set({ reservePrice: "3900.00" }).where(eq(lot.id, lotId));
      expect(await repo.settleOnReturn(db, { lotId, lotEndTime: ended }, staffId, now)).toBeNull();
      const [kept] = await db.select().from(lot).where(eq(lot.id, lotId));
      expect(kept?.reservePrice).toBe("3900.00");
    });
  });

  it("closes a relist that agreed no reserve without touching the lot's reserve", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleUnsoldLotFollowUpRepository(db);
      const { lotId, submissionId } = await confirmed(db, { choice: "relist" });
      await repo.openForConfirmedChoice(submissionId, lotId);
      const settled = await repo.settleOnReturn(db, { lotId, lotEndTime: ended }, staffId, now);
      expect(settled?.appliedReserve).toBeNull();
      const [after] = await db.select().from(lot).where(eq(lot.id, lotId));
      expect(after?.reservePrice).toBe("5000.00");
      expect(
        (await repo.findForOutcome({ lotId, lotEndTime: ended }))?.reserveAppliedAt,
      ).toBeNull();
    });
  });

  it("lets staff finish a return once, and never a relist", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleUnsoldLotFollowUpRepository(db);
      const collect = await confirmed(db, { choice: "collect" });
      await repo.openForConfirmedChoice(collect.submissionId, collect.lotId);
      const key = { lotId: collect.lotId, lotEndTime: ended };
      expect(await repo.completeByStaff(key, staffId, now)).toMatchObject({
        status: "done",
        completedByUserId: staffId,
      });
      expect(await repo.completeByStaff(key, staffId, now)).toBeNull();

      const relist = await confirmed(db, { choice: "relist", title: "Other" });
      await repo.openForConfirmedChoice(relist.submissionId, relist.lotId);
      expect(
        await repo.completeByStaff({ lotId: relist.lotId, lotEndTime: ended }, staffId, now),
      ).toBeNull();
    });
  });

  it("refuses to relist a lot confirmed for return, and allows one confirmed for a relist", async () => {
    await inRollback(async (db) => {
      const guard = new DrizzleLotTransitionGuardReader(db);
      const collect = await confirmed(db, { choice: "collect" });
      expect(await guard.assertReturnToInventoryAllowed(collect.lotId)).toMatch(
        /confirmed for return/,
      );
      const relist = await confirmed(db, { choice: "relist", title: "Other" });
      expect(await guard.assertReturnToInventoryAllowed(relist.lotId)).toBeNull();
    });
  });

  it("lists the open work for the inbox, worded by kind, and drops it once done", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleUnsoldLotFollowUpRepository(db);
      const reader = new DrizzleAdminWorkItemsReader(db);
      const relist = await confirmed(db, { choice: "relist", reserve: "4200.00", title: "Blue" });
      const collect = await confirmed(db, { choice: "collect", title: "Red" });
      const privateSale = await confirmed(db, { choice: "private_sale", title: "Green" });
      for (const c of [relist, collect, privateSale]) {
        await repo.openForConfirmedChoice(c.submissionId, c.lotId);
      }

      const items = await reader.listOpenUnsoldFollowUps(50);
      expect(items.map((i) => i.title).sort()).toEqual([
        "Arrange return — Red",
        "Private sale — Green",
        "Relist — Blue",
      ]);
      const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
      expect(byTitle["Relist — Blue"]?.subtitle).toContain("£4,200.00");
      expect(byTitle["Private sale — Green"]?.subtitle).toBe("For the private sales team");
      expect(byTitle["Arrange return — Red"]).toMatchObject({
        kind: "unsold_choice_follow_up",
        href: `/admin/submissions/${collect.submissionId}/decision`,
      });

      await repo.completeByStaff({ lotId: collect.lotId, lotEndTime: ended }, staffId, now);
      expect((await reader.listOpenUnsoldFollowUps(50)).map((i) => i.title)).not.toContain(
        "Arrange return — Red",
      );
    });
  });

  it("lists an unsold lot whose choose-by date passed with no choice, until someone chooses", async () => {
    await inRollback(async (db) => {
      const reader = new DrizzleAdminWorkItemsReader(db);
      const [created] = await db
        .insert(lot)
        .values({
          sellerLegalEntityId: entityId,
          title: "Quiet work",
          auctionType: "english",
          startingPrice: "100.00",
          currentPrice: "100.00",
          startTime: new Date(ended.getTime() - 86_400_000),
          endTime: ended,
          status: "ended",
        })
        .returning({ id: lot.id });
      const lotId = created?.id as string;
      const [submission] = await db
        .insert(itemSubmission)
        .values({
          legalEntityId: entityId,
          title: "Quiet work",
          status: "converted",
          convertedLotId: lotId,
          submittedByUserId: ownerId,
        })
        .returning({ id: itemSubmission.id });
      const submissionId = submission?.id as string;
      await db.insert(unsoldChoiceDeadline).values({
        lotId,
        lotEndTime: ended,
        chooseBy: new Date("2026-11-03T18:00:00Z"),
      });

      expect(await reader.listLapsedUnsoldChoices(50, new Date("2026-11-03T17:00:00Z"))).toEqual(
        [],
      );
      const [item] = await reader.listLapsedUnsoldChoices(50, now);
      expect(item).toMatchObject({
        kind: "unsold_choice_lapsed",
        sourceId: lotId,
        title: "No choice made — Quiet work",
        href: `/admin/submissions/${submissionId}/decision`,
      });
      expect(item?.subtitle).toContain("3 Nov");

      // A request waiting for a specialist has its own item, so it is not listed twice.
      await db.insert(unsoldLotChoice).values({
        lotId,
        submissionId,
        legalEntityId: entityId,
        lotEndTime: ended,
        status: "requested",
        requestedChoice: "relist",
      });
      expect(await reader.listLapsedUnsoldChoices(50, now)).toEqual([]);
    });
  });
});
