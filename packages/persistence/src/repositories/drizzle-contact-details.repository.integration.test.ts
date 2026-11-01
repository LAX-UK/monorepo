import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleContactDetailsRepository } from "./drizzle-contact-details.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleContactDetailsRepository (integration)", () => {
  it("has nothing for a new organisation, then saves, replaces and clears its details", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const ownerId = `contact-owner-${randomUUID().slice(0, 8)}`;
    const orgId = randomUUID();
    const otherOrgId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: ownerId,
          name: "Olivia Owner",
          email: `${ownerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values(
          [orgId, otherOrgId].map((id) => ({
            id,
            displayName: id,
            kind: "organisation" as const,
            subkind: "gallery" as const,
            createdByUserId: ownerId,
            status: "approved" as const,
            createdAt: now,
            updatedAt: now,
          })),
        );

        const contacts = new DrizzleContactDetailsRepository(tx as never);
        expect(await contacts.find(orgId)).toBeNull();

        await contacts.save(
          orgId,
          { email: "hello@northbank.gallery", phone: "+44 20 7946 0321", website: null },
          ownerId,
        );
        const replaced = await contacts.save(
          orgId,
          { email: "hello@northbank.gallery", phone: null, website: "https://northbank.gallery" },
          ownerId,
        );
        expect(replaced).toMatchObject({
          email: "hello@northbank.gallery",
          phone: null,
          website: "https://northbank.gallery",
        });
        expect(replaced.updatedAt).toBeInstanceOf(Date);
        expect(await contacts.find(orgId)).toMatchObject({ phone: null });
        // Another organisation's details are separate.
        expect(await contacts.find(otherOrgId)).toBeNull();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
