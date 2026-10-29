import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, lot, unsoldLotChoice, user } from "@auction/db/schema";
import type { LotStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { DrizzleUnsoldLotChoiceRepository } from "./drizzle-unsold-lot-choice.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  "DrizzleUnsoldLotChoiceRepository.listUnsoldOutcomes (integration)",
  () => {
    const ownerId = "uoc-it-owner";
    const consignorId = "uoc-it-consignor";
    const winnerId = "uoc-it-winner";
    const entityId = "a0c00000-0000-4000-8000-000000000001";
    const otherEntityId = "a0c00000-0000-4000-8000-000000000002";
    const t = new Date("2026-10-01T00:00:00Z");
    const ENDED: readonly LotStatus[] = ["ended", "voided"];

    async function inRollback(run: (db: Database) => Promise<void>) {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL required");
      const db = createDb(databaseUrl);
      const rollback = new Error("rollback_unsold_outcomes_test");
      try {
        await db.transaction(async (tx) => {
          for (const id of [ownerId, consignorId, winnerId]) {
            await tx.insert(user).values({
              id,
              name: id,
              email: `${id}@integration.test`,
              emailVerified: true,
              createdAt: t,
              updatedAt: t,
            });
          }
          for (const id of [entityId, otherEntityId]) {
            await tx.insert(legalEntity).values({
              id,
              displayName: id === entityId ? "Northbank Gallery" : "Elsewhere Ltd",
              kind: "organisation",
              subkind: "gallery",
              createdByUserId: ownerId,
              status: "approved",
              createdAt: t,
              updatedAt: t,
            });
          }
          await run(tx as unknown as Database);
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    }

    /** A consigned lot with its submission; returns the lot id and its end time. */
    async function consign(
      db: Database,
      input: {
        title: string;
        status: LotStatus;
        endTime: Date;
        winner?: string;
        sentBy?: string | null;
        entity?: string;
      },
    ) {
      const entity = input.entity ?? entityId;
      const [created] = await db
        .insert(lot)
        .values({
          sellerLegalEntityId: entity,
          title: input.title,
          auctionType: "english",
          startingPrice: "100.00",
          currentPrice: "100.00",
          startTime: new Date(input.endTime.getTime() - 86_400_000),
          endTime: input.endTime,
          status: input.status,
          winnerId: input.winner ?? null,
        })
        .returning({ id: lot.id });
      const lotId = created?.id as string;
      const [submission] = await db
        .insert(itemSubmission)
        .values({
          legalEntityId: entity,
          title: input.title,
          status: "converted",
          convertedLotId: lotId,
          submittedByUserId: input.sentBy === undefined ? consignorId : input.sentBy,
        })
        .returning({ id: itemSubmission.id });
      return { lotId, submissionId: submission?.id as string, endTime: input.endTime };
    }

    it("lists the account's lots that ended unsold, newest first, with the latest outcome's choice", async () => {
      await inRollback(async (db) => {
        const repo = new DrizzleUnsoldLotChoiceRepository(db);
        const open = await consign(db, {
          title: "Harbour at Dusk",
          status: "ended",
          endTime: new Date("2026-10-20T18:00:00Z"),
        });
        const asked = await consign(db, {
          title: "Study in Ochre",
          status: "voided",
          endTime: new Date("2026-10-18T18:00:00Z"),
          sentBy: null,
        });
        // Relisted and unsold again: the old outcome's choice does not count for the new one.
        const relisted = await consign(db, {
          title: "Untitled (Blue)",
          status: "ended",
          endTime: new Date("2026-10-22T18:00:00Z"),
        });
        await consign(db, {
          title: "Sold work",
          status: "ended",
          endTime: new Date("2026-10-21T18:00:00Z"),
          winner: winnerId,
        });
        await consign(db, {
          title: "Live work",
          status: "active",
          endTime: new Date("2026-11-01"),
        });
        await consign(db, {
          title: "Elsewhere",
          status: "ended",
          endTime: new Date("2026-10-19T18:00:00Z"),
          entity: otherEntityId,
        });
        await db.insert(unsoldLotChoice).values([
          {
            lotId: asked.lotId,
            submissionId: asked.submissionId,
            legalEntityId: entityId,
            lotEndTime: asked.endTime,
            status: "requested",
            requestedChoice: "relist",
          },
          {
            lotId: relisted.lotId,
            submissionId: relisted.submissionId,
            legalEntityId: entityId,
            lotEndTime: new Date("2026-09-01T18:00:00Z"),
            status: "confirmed",
            decidedChoice: "relist",
          },
        ]);

        const all = await repo.listUnsoldOutcomes({
          legalEntityId: entityId,
          endedStatuses: ENDED,
          limit: 50,
          offset: 0,
        });
        expect(all.total).toBe(3);
        expect(all.rows.map((row) => [row.title, row.choice])).toEqual([
          ["Untitled (Blue)", null],
          ["Harbour at Dusk", null],
          ["Study in Ochre", "requested"],
        ]);
        expect(all.rows[1]).toMatchObject({ lotId: open.lotId, submissionId: open.submissionId });

        const waiting = await repo.listUnsoldOutcomes({
          legalEntityId: entityId,
          endedStatuses: ENDED,
          choice: "none",
          limit: 1,
          offset: 1,
        });
        expect(waiting.total).toBe(2);
        expect(waiting.rows.map((row) => row.title)).toEqual(["Harbour at Dusk"]);

        const ownOnly = await repo.listUnsoldOutcomes({
          legalEntityId: entityId,
          endedStatuses: ENDED,
          visibleTo: { scope: "attributed", userId: consignorId },
          limit: 50,
          offset: 0,
        });
        expect(ownOnly.rows.map((row) => row.title)).toEqual([
          "Untitled (Blue)",
          "Harbour at Dusk",
        ]);
      });
    });
  },
);
