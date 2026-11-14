import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import { consignmentAgreement, itemSubmission, legalEntity, user } from "@auction/db/schema";
import { CONSIGNMENT_MOVABLE_STATUSES } from "@auction/domain";
import { asc, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleConsignmentAgreementRepository } from "./drizzle-consignment-agreement.repository.js";
import { DrizzleConsignmentMoveWriter } from "./drizzle-consignment-move.writer.js";
import { DrizzleConsignmentThreadFactsReader } from "./drizzle-consignment-thread-facts.reader.js";
import { DrizzleSignedAgreementWriter } from "./drizzle-signed-agreement.writer.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * A signed agreement's versions against a real database, under api_app's grants: moving the
 * consignment adds the next version and keeps the signed one superseded, an unsigned proposal moves
 * in place, and the repository and the thread read, re-propose and set the relist floor on the
 * current version only. Rolled back.
 */
describe.skipIf(!HAS_DB)("consignment agreement versions (integration)", () => {
  it("versions a signed agreement on a move and reads only the current version", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const userId = `versions-${tag}`;
    const [person, organisation] = [randomUUID(), randomUUID()];
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        const conn = tx as unknown as Database;
        await tx.insert(user).values({
          id: userId,
          name: "Fixture Seller",
          email: `${userId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        for (const id of [person, organisation]) {
          await tx.insert(legalEntity).values({
            id,
            displayName: `Seller ${tag}`,
            kind: "organisation",
            subkind: "gallery",
            primaryCountry: "GB",
            createdByUserId: userId,
          } as typeof legalEntity.$inferInsert);
        }
        const consign = async (acceptedAt: Date | null) => {
          const submissionId = randomUUID();
          await tx
            .insert(itemSubmission)
            .values({ id: submissionId, legalEntityId: person, title: "Work", status: "approved" });
          await tx.insert(consignmentAgreement).values({
            submissionId,
            legalEntityId: person,
            termsVersion: "v1",
            estimateLow: "1000.00",
            estimateHigh: "1500.00",
            commissionPercent: "12.00",
            acceptedAt,
            acceptedByUserId: acceptedAt ? userId : null,
          });
          return submissionId;
        };
        const signedId = await consign(new Date("2026-10-03T10:00:00Z"));
        const proposedId = await consign(null);

        // From here on every statement is checked against api_app's grants, as in production.
        await tx.execute(sql`set local role api_app`);
        const writer = new DrizzleConsignmentMoveWriter(conn);
        const move = (submissionId: string) =>
          writer.move({
            submissionId,
            fromLegalEntityId: person,
            toLegalEntityId: organisation,
            movableStatuses: CONSIGNMENT_MOVABLE_STATUSES,
            resetAgreementAcceptance: true,
            sellerUserId: userId,
            movedAt: now,
          });
        expect(await move(signedId)).toBe(true);
        expect(await move(proposedId)).toBe(true);

        const history = await tx
          .select()
          .from(consignmentAgreement)
          .where(eq(consignmentAgreement.submissionId, signedId))
          .orderBy(asc(consignmentAgreement.version));
        expect(history).toHaveLength(2);
        expect(history[0]).toMatchObject({
          version: 1,
          legalEntityId: person,
          acceptedAt: new Date("2026-10-03T10:00:00Z"),
          supersededBy: history[1]?.id,
        });
        expect(history[1]).toMatchObject({
          version: 2,
          legalEntityId: organisation,
          acceptedAt: null,
          commissionPercent: "12.00",
          proposedAt: now,
          supersededAt: null,
        });
        const proposed = await tx
          .select()
          .from(consignmentAgreement)
          .where(eq(consignmentAgreement.submissionId, proposedId));
        expect(proposed).toHaveLength(1);
        expect(proposed[0]).toMatchObject({ version: 1, legalEntityId: organisation });

        // The consignment's thread reads the current version: waiting for the new owner.
        const facts = await new DrizzleConsignmentThreadFactsReader(conn).readFacts(signedId);
        expect(facts?.agreement).toMatchObject({ acceptedAt: null, proposedAt: now });

        // Recording a signed copy decides on the current version too: unsigned since the move.
        expect(await new DrizzleSignedAgreementWriter(tx).lockAgreement(signedId)).toMatchObject({
          id: history[1]?.id,
          acceptedAt: null,
        });

        const agreements = new DrizzleConsignmentAgreementRepository(conn);
        expect((await agreements.findBySubmissionId(signedId))?.id).toBe(history[1]?.id);
        expect((await agreements.listBySubmissionIds([signedId])).map((a) => a.id)).toEqual([
          history[1]?.id,
        ]);
        expect(await agreements.listByLegalEntity(person)).toEqual([]);
        // The new owner is asked to accept the current version again; the signed one is kept.
        const reproposed = await agreements.propose({
          submissionId: signedId,
          legalEntityId: organisation,
          termsVersion: "v1",
          estimateLow: "1100.00",
          estimateHigh: "1600.00",
          reservePrice: null,
          commissionPercent: "12.00",
          currency: "GBP",
          proposedByUserId: userId,
          proposedAt: now,
        });
        expect(reproposed).toMatchObject({ id: history[1]?.id, estimateLow: "1100.00" });
        const floored = await agreements.setRelistReserveFloor(signedId, "800.00", now);
        expect(floored?.relistReserveFloor).toBe("800.00");
        // Moving back changes the current, unsigned version in place; the signed one stays.
        expect(
          await writer.move({
            submissionId: signedId,
            fromLegalEntityId: organisation,
            toLegalEntityId: person,
            movableStatuses: CONSIGNMENT_MOVABLE_STATUSES,
            resetAgreementAcceptance: false,
            sellerUserId: null,
            movedAt: now,
          }),
        ).toBe(true);
        expect(await agreements.findBySubmissionId(signedId)).toMatchObject({
          id: history[1]?.id,
          legalEntityId: person,
        });
        const [first] = await tx
          .select()
          .from(consignmentAgreement)
          .where(eq(consignmentAgreement.id, history[0]?.id as string));
        expect(first).toMatchObject({ estimateLow: "1000.00", relistReserveFloor: null });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
