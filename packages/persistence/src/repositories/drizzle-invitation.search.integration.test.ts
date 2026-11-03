import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { user, userInvitation } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { containsPattern } from "../lib/like-pattern.js";
import { DrizzleUserInvitationRepository } from "./drizzle-invitation.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** Wildcard characters typed into the staff search box match themselves, not other rows. */
describe.skipIf(!HAS_DB)("invitation search with wildcard characters (integration)", () => {
  async function inRollback(
    run: (ctx: { repo: DrizzleUserInvitationRepository; tag: string }) => Promise<void>,
  ) {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        const inviterId = `invite-search-${tag}`;
        await tx.insert(user).values({
          id: inviterId,
          name: inviterId,
          email: `${inviterId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        const emails = [
          `${tag}-50%@integration.test`,
          `${tag}-500@integration.test`,
          `${tag}-a_b@integration.test`,
          `${tag}-axb@integration.test`,
          `${tag}-c\\d@integration.test`,
          `${tag}-cd@integration.test`,
        ];
        for (const email of emails) {
          await tx.insert(userInvitation).values({
            id: randomUUID(),
            email,
            targetRole: "client",
            tokenHash: `invite-search-${randomUUID()}`,
            status: "revoked",
            createdByUserId: inviterId,
            expiresAt: new Date(now.getTime() + 3_600_000),
          });
        }
        await run({ repo: new DrizzleUserInvitationRepository(tx), tag });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  async function search(repo: DrizzleUserInvitationRepository, text: string) {
    const rows = await repo.listAdmin({ q: text }, { limit: 50, offset: 0 });
    return rows.map((row) => row.email).sort();
  }

  it("matches a percent sign literally", async () => {
    await inRollback(async ({ repo, tag }) => {
      expect(await search(repo, `${tag}-50%`)).toEqual([`${tag}-50%@integration.test`]);
    });
  });

  it("matches an underscore literally", async () => {
    await inRollback(async ({ repo, tag }) => {
      expect(await search(repo, `${tag}-a_b`)).toEqual([`${tag}-a_b@integration.test`]);
    });
  });

  it("matches a backslash literally", async () => {
    await inRollback(async ({ repo, tag }) => {
      expect(await search(repo, `${tag}-c\\d`)).toEqual([`${tag}-c\\d@integration.test`]);
    });
  });

  it("still finds rows by plain text", async () => {
    await inRollback(async ({ repo, tag }) => {
      expect(await search(repo, tag)).toHaveLength(6);
    });
  });
});

describe.skipIf(!HAS_DB)("containsPattern against PostgreSQL (integration)", () => {
  it("makes %, _ and backslash match only themselves in ilike", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const matches = async (text: string) => {
      const result = await db.execute(
        sql`select t from (values ('50%'), ('500'), ('a_b'), ('axb'), ('c\d'), ('cd')) as v(t) where t ilike ${containsPattern(text)} order by t`,
      );
      return ((result as unknown as { rows: { t: string }[] }).rows ?? []).map((row) => row.t);
    };
    expect(await matches("50%")).toEqual(["50%"]);
    expect(await matches("a_b")).toEqual(["a_b"]);
    expect(await matches("c\\d")).toEqual(["c\\d"]);
  });
});
