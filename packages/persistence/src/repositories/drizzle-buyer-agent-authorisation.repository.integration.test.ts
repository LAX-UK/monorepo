import { type Database, createDb } from "@auction/db";
import { bidIdentityDirectory, legalEntity, sale, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleBuyerAgentAuthorisationReader } from "./drizzle-buyer-agent-authorisation.reader.js";
import { DrizzleBuyerAgentAuthorisationRepository } from "./drizzle-buyer-agent-authorisation.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleBuyerAgentAuthorisationRepository (integration)", () => {
  const ownerId = "baa-it-owner";
  const agentId = "baa-it-agent";
  const entityId = "baa00000-0000-4000-8000-000000000001";
  const saleId = "baa00000-0000-4000-8000-000000000002";
  const t = new Date("2026-10-01T00:00:00Z");

  async function inRollback(run: (db: Database) => Promise<void>) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_buyer_agent_authorisation_test");
    try {
      await db.transaction(async (tx) => {
        for (const [id, name] of [
          [ownerId, "Olivia Owner"],
          [agentId, "Adam Agent"],
        ] as const) {
          await tx.insert(user).values({
            id,
            name,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
          await tx.insert(bidIdentityDirectory).values({
            subjectId: id,
            name,
            email: `${id}@integration.test`,
            identityCreatedAt: t,
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
        await tx.insert(sale).values({
          id: saleId,
          title: "Modern British",
          startTime: new Date("2026-11-20T10:00:00Z"),
          endTime: new Date("2026-11-21T18:00:00Z"),
          createdByLegalEntityId: entityId,
        });
        await run(tx as unknown as Database);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it("grants, lists with names, supersedes the same scope and revokes", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleBuyerAgentAuthorisationRepository(db);
      const reader = new DrizzleBuyerAgentAuthorisationReader(db);
      const base = {
        legalEntityId: entityId,
        userId: agentId,
        validFrom: t,
        validUntil: null,
        createdByUserId: ownerId,
      };

      const allSales = await repo.grant(
        { ...base, saleId: null, bidLimit: "5000.00", totalLimit: null },
        "Replaced",
      );
      const oneSale = await repo.grant(
        { ...base, saleId, bidLimit: null, totalLimit: null },
        "Replaced",
      );
      expect(allSales.supersededId).toBeNull();
      expect(oneSale.supersededId).toBeNull();

      const replaced = await repo.grant(
        { ...base, saleId: null, bidLimit: "8000.00", totalLimit: "40000.00" },
        "Replaced",
      );
      expect(replaced.supersededId).toBe(allSales.id);

      const listed = await repo.listForLegalEntity(entityId);
      expect(listed.map((r) => [r.status, r.saleTitle, r.bidLimit])).toEqual(
        expect.arrayContaining([
          ["active", null, "8000.00"],
          ["active", "Modern British", null],
          ["revoked", null, "5000.00"],
        ]),
      );
      expect(listed[0]).toMatchObject({ userName: "Adam Agent", createdByName: "Olivia Owner" });
      expect(listed.at(-1)).toMatchObject({ status: "revoked", revokedReason: "Replaced" });

      const now = new Date("2026-11-20T12:00:00Z");
      expect(
        await reader.findActiveAuthorisations({
          legalEntityId: entityId,
          userId: agentId,
          saleId,
          now,
        }),
      ).toHaveLength(2);

      expect(
        await repo.revoke({
          legalEntityId: entityId,
          authorisationId: oneSale.id,
          reason: "Left the gallery",
          revokedAt: now,
        }),
      ).toBe(true);
      expect(
        await repo.revoke({
          legalEntityId: entityId,
          authorisationId: oneSale.id,
          reason: "Twice",
          revokedAt: now,
        }),
      ).toBe(false);
      expect(
        await reader.findActiveAuthorisations({
          legalEntityId: entityId,
          userId: agentId,
          saleId,
          now,
        }),
      ).toEqual([{ saleId: null, bidLimit: "8000.00", totalLimit: "40000.00" }]);

      const found = await repo.findForLegalEntity(entityId, oneSale.id);
      expect(found).toMatchObject({ status: "revoked", revokedReason: "Left the gallery" });
      expect(
        await repo.findForLegalEntity("baa00000-0000-4000-8000-0000000000ff", oneSale.id),
      ).toBe(null);
    });
  });

  it("ignores authorisations outside their valid window", async () => {
    await inRollback(async (db) => {
      const repo = new DrizzleBuyerAgentAuthorisationRepository(db);
      const reader = new DrizzleBuyerAgentAuthorisationReader(db);
      await repo.grant(
        {
          legalEntityId: entityId,
          userId: agentId,
          saleId: null,
          bidLimit: null,
          totalLimit: null,
          validFrom: new Date("2026-11-01T00:00:00Z"),
          validUntil: new Date("2026-11-30T00:00:00Z"),
          createdByUserId: ownerId,
        },
        "Replaced",
      );
      const query = { legalEntityId: entityId, userId: agentId, saleId };
      expect(
        await reader.findActiveAuthorisations({ ...query, now: new Date("2026-10-31T23:00:00Z") }),
      ).toEqual([]);
      expect(
        await reader.findActiveAuthorisations({ ...query, now: new Date("2026-11-15T00:00:00Z") }),
      ).toHaveLength(1);
      expect(
        await reader.findActiveAuthorisations({ ...query, now: new Date("2026-11-30T00:00:01Z") }),
      ).toEqual([]);
    });
  });
});
