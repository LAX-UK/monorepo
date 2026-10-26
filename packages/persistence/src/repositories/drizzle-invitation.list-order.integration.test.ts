import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { user, userInvitation } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import type { InvitationAdminListSort } from "../interfaces/invitation.repository.js";
import { DrizzleUserInvitationRepository } from "./drizzle-invitation.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const hour = 3_600_000;
const base = Date.UTC(2026, 5, 1, 9, 0, 0);
const at = (hours: number) => new Date(base + hours * hour);

/**
 * The staff Invitations list orders on the server: a default of newest first, and each sortable
 * column both ways, always ending on the invitation id so rows that tie on the column keep one
 * order and pages never overlap. Runs in a transaction that is rolled back.
 */
describe.skipIf(!HAS_DB)("invitation list ordering (integration)", () => {
  async function inRollback(
    run: (ctx: {
      repo: DrizzleUserInvitationRepository;
      tag: string;
      alpha: string;
      bravo: string;
      charlie: string;
      tiedAscending: string[];
    }) => Promise<void>,
  ) {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        const inviterId = `invite-order-${tag}`;
        await tx.insert(user).values({
          id: inviterId,
          name: inviterId,
          email: `${inviterId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });

        // alpha: oldest and last to expire; bravo: middle; charlie: newest of the distinct three.
        // The two "delta" rows tie on every column, so only the id can order them.
        const rows = [
          { key: "alpha", created: 0, expires: 30, email: `${tag}-alpha@integration.test` },
          { key: "bravo", created: 20, expires: 10, email: `${tag}-bravo@integration.test` },
          { key: "charlie", created: 10, expires: 20, email: `${tag}-charlie@integration.test` },
          { key: "delta-1", created: 30, expires: 40, email: `${tag}-delta@integration.test` },
          { key: "delta-2", created: 30, expires: 40, email: `${tag}-delta@integration.test` },
        ];
        const ids: Record<string, string> = {};
        for (const row of rows) {
          ids[row.key] = randomUUID();
          await tx.insert(userInvitation).values({
            id: ids[row.key],
            email: row.email,
            targetRole: "client",
            tokenHash: `invite-order-${tag}-${row.key}`,
            status: "revoked",
            createdByUserId: inviterId,
            createdAt: at(row.created),
            updatedAt: at(row.created),
            expiresAt: at(row.expires),
          });
        }

        await run({
          repo: new DrizzleUserInvitationRepository(tx),
          tag,
          alpha: ids.alpha as string,
          bravo: ids.bravo as string,
          charlie: ids.charlie as string,
          tiedAscending: [ids["delta-1"] as string, ids["delta-2"] as string].sort(),
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it("lists newest first when no sort is given, and for created_desc", async () => {
    await inRollback(async ({ repo, tag, alpha, bravo, charlie, tiedAscending }) => {
      const expected = [...[...tiedAscending].reverse(), bravo, charlie, alpha];
      const byDefault = await repo.listAdmin({ q: tag }, { limit: 50, offset: 0 });
      expect(byDefault.map((row) => row.id)).toEqual(expected);
      const explicit = await repo.listAdmin(
        { q: tag },
        { limit: 50, offset: 0, sort: "created_desc" },
      );
      expect(explicit.map((row) => row.id)).toEqual(expected);
    });
  });

  it("orders by every sortable column, ties by invitation id in the same direction", async () => {
    await inRollback(async ({ repo, tag, alpha, bravo, charlie, tiedAscending }) => {
      const tiedDescending = [...tiedAscending].reverse();
      const expected: Record<InvitationAdminListSort, string[]> = {
        created_desc: [...tiedDescending, bravo, charlie, alpha],
        created_asc: [alpha, charlie, bravo, ...tiedAscending],
        expires_asc: [bravo, charlie, alpha, ...tiedAscending],
        expires_desc: [...tiedDescending, alpha, charlie, bravo],
        email_asc: [alpha, bravo, charlie, ...tiedAscending],
        email_desc: [...tiedDescending, charlie, bravo, alpha],
      };
      for (const [sort, ids] of Object.entries(expected) as [InvitationAdminListSort, string[]][]) {
        const rows = await repo.listAdmin({ q: tag }, { limit: 50, offset: 0, sort });
        expect(
          rows.map((row) => row.id),
          sort,
        ).toEqual(ids);
      }
    });
  });

  it("pages through each order without repeating or skipping a row", async () => {
    await inRollback(async ({ repo, tag }) => {
      const sorts: InvitationAdminListSort[] = [
        "created_desc",
        "created_asc",
        "expires_asc",
        "expires_desc",
        "email_asc",
        "email_desc",
      ];
      for (const sort of sorts) {
        const whole = await repo.listAdmin({ q: tag }, { limit: 50, offset: 0, sort });
        const paged: string[] = [];
        for (let offset = 0; offset < whole.length; offset += 2) {
          const page = await repo.listAdmin({ q: tag }, { limit: 2, offset, sort });
          paged.push(...page.map((row) => row.id));
        }
        expect(paged, sort).toEqual(whole.map((row) => row.id));
      }
    });
  });
});
