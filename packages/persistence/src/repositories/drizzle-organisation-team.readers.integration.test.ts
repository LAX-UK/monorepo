import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidIdentityDirectory,
  domainEvent,
  legalEntity,
  legalEntityMember,
  user,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import {
  DrizzleInvoiceDetailsRepository,
  DrizzleOrganisationActivityReader,
} from "./drizzle-organisation-team.readers.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("organisation team readers (integration)", () => {
  it("saves invoice details and reads an organisation's activity only", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const day = 86_400_000;
    const tag = randomUUID().slice(0, 8);
    const ownerId = `team-owner-${tag}`;
    const memberId = `team-member-${tag}`;
    const staffId = `team-staff-${tag}`;
    const orgId = randomUUID();
    const otherOrgId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        for (const [id, name] of [
          [ownerId, "Olivia Owner"],
          [memberId, "Max Member"],
          [staffId, "Sam Staff"],
        ] as const) {
          await tx.insert(user).values({
            id,
            name,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(bidIdentityDirectory).values({
            subjectId: id,
            name,
            email: `${id}@integration.test`,
            identityCreatedAt: now,
          });
        }
        const organisation = (id: string) => ({
          id,
          displayName: id,
          kind: "organisation" as const,
          subkind: "gallery" as const,
          createdByUserId: ownerId,
          status: "approved" as const,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values([organisation(orgId), organisation(otherOrgId)]);
        await tx.insert(legalEntityMember).values([
          { legalEntityId: orgId, userId: ownerId, role: "owner", acceptedAt: now },
          // Removed since: still named in history as a former member.
          {
            legalEntityId: orgId,
            userId: memberId,
            role: "finance",
            acceptedAt: now,
            removedAt: now,
          },
        ]);

        const event = (
          eventType: string,
          fields: Partial<typeof domainEvent.$inferInsert>,
          occurredAt = now,
        ) => ({
          aggregateType: "legal_entity",
          aggregateId: orgId,
          eventType,
          payload: {},
          producer: "apps/api",
          occurredAt,
          ...fields,
        });
        await tx.insert(domainEvent).values([
          event("legal_entity.member_role_changed", {
            actorUserId: ownerId,
            actingLegalEntityId: orgId,
            payload: { member_user_id: memberId, from_role: "viewer", to_role: "finance" },
          }),
          event("legal_entity.member_removed", {
            actorUserId: ownerId,
            actingLegalEntityId: orgId,
            payload: { member_user_id: memberId },
          }),
          // Recorded while acting for the organisation, about another aggregate.
          event("payout.paid", {
            aggregateType: "payout",
            aggregateId: randomUUID(),
            actingLegalEntityId: orgId,
            payload: { netAmount: "900.00", currency: "GBP" },
          }),
          // About the organisation, recorded by staff (no acting organisation).
          event("auth.two_factor_policy_changed", {
            actorUserId: staffId,
            payload: { required: true },
          }),
          // Too old, another organisation's, and a type Activity never shows.
          event(
            "legal_entity.member_accepted",
            { actingLegalEntityId: orgId },
            new Date(now.getTime() - 400 * day),
          ),
          event("legal_entity.member_accepted", {
            aggregateId: otherOrgId,
            actingLegalEntityId: otherOrgId,
          }),
          event("legal_entity.restricted", {}),
        ]);

        const reader = new DrizzleOrganisationActivityReader(tx as never);
        const filter = {
          legalEntityId: orgId,
          eventTypes: [
            "legal_entity.member_role_changed",
            "legal_entity.member_removed",
            "legal_entity.member_accepted",
            "payout.paid",
            "auth.two_factor_policy_changed",
          ] as const,
          since: new Date(now.getTime() - 365 * day),
          until: new Date(now.getTime() + day),
          limit: 10,
        };
        const all = await reader.list(filter);
        expect(all.map((row) => row.eventType)).toEqual([
          "auth.two_factor_policy_changed",
          "payout.paid",
          "legal_entity.member_removed",
          "legal_entity.member_role_changed",
        ]);

        // By person: done by them or about them.
        const aboutMember = await reader.list({ ...filter, personUserId: memberId });
        expect(aboutMember.map((row) => row.eventType)).toEqual([
          "legal_entity.member_removed",
          "legal_entity.member_role_changed",
        ]);

        // Paging by id: the next page starts after the last row.
        const firstPage = await reader.list({ ...filter, limit: 2 });
        const nextPage = await reader.list({ ...filter, beforeId: firstPage[1]?.id, limit: 2 });
        expect(nextPage.map((row) => row.eventType)).toEqual([
          "legal_entity.member_removed",
          "legal_entity.member_role_changed",
        ]);

        const people = await reader.people(orgId, [ownerId, memberId, staffId]);
        expect(people.get(memberId)).toEqual({ name: "Max Member", wasMember: true });
        expect(people.get(staffId)).toEqual({ name: "Sam Staff", wasMember: false });

        const invoices = new DrizzleInvoiceDetailsRepository(tx as never);
        expect(await invoices.find(orgId)).toBeNull();
        const saved = await invoices.save(
          orgId,
          {
            billingEmail: "accounts@northbank.example",
            address: {
              line1: "1 Cork Street",
              line2: null,
              city: "London",
              region: null,
              postalCode: "W1S 3LL",
              country: "GB",
            },
            poReference: "PO-4471",
          },
          ownerId,
        );
        expect(saved).toMatchObject({ poReference: "PO-4471", address: { city: "London" } });
        const cleared = await invoices.save(
          orgId,
          { billingEmail: null, address: null, poReference: null },
          ownerId,
        );
        expect(cleared).toMatchObject({ billingEmail: null, address: null, poReference: null });
        expect(await invoices.find(orgId)).toMatchObject({ address: null });

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
