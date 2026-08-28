import { createDb } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, user, userInvitation } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleUserInvitationRepository } from "./drizzle-invitation.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("invitation redemption concurrency (integration)", () => {
  const inviterId = "inv_concurrency_inviter";
  const redeemer1Id = "inv_concurrency_redeemer_1";
  const redeemer2Id = "inv_concurrency_redeemer_2";
  const email = "inv-concurrency@integration.test";
  const tokenHash = "inv-concurrency-token-hash-0001";
  const dupTokenHash = "inv-concurrency-token-hash-0002";

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleUserInvitationRepository(db);

  afterAll(async () => {
    await db.delete(userInvitation).where(sql`lower(${userInvitation.email}) = ${email}`);
    await db
      .delete(bidUserProfile)
      .where(sql`${bidUserProfile.userId} IN (${redeemer1Id}, ${redeemer2Id})`);
    await db
      .delete(bidIdentityDirectory)
      .where(sql`${bidIdentityDirectory.subjectId} IN (${redeemer1Id}, ${redeemer2Id})`);
    await db.delete(user).where(sql`${user.id} IN (${inviterId}, ${redeemer1Id}, ${redeemer2Id})`);
  });

  async function seedUsersAndInvite(): Promise<void> {
    const t = new Date();
    await db.delete(userInvitation).where(sql`lower(${userInvitation.email}) = ${email}`);
    await db
      .delete(bidUserProfile)
      .where(sql`${bidUserProfile.userId} IN (${redeemer1Id}, ${redeemer2Id})`);
    await db
      .delete(bidIdentityDirectory)
      .where(sql`${bidIdentityDirectory.subjectId} IN (${redeemer1Id}, ${redeemer2Id})`);
    await db.delete(user).where(sql`${user.id} IN (${inviterId}, ${redeemer1Id}, ${redeemer2Id})`);
    await db.insert(user).values([
      {
        id: inviterId,
        name: "Inviter",
        email: `${inviterId}@t.test`,
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: redeemer1Id,
        name: "R1",
        email: `${redeemer1Id}@t.test`,
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: redeemer2Id,
        name: "R2",
        email: `${redeemer2Id}@t.test`,
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      },
    ]);
    await db.insert(bidIdentityDirectory).values([
      {
        subjectId: redeemer1Id,
        email: `${redeemer1Id}@t.test`,
        name: "R1",
        emailVerified: true,
        identityCreatedAt: t,
        replicatedAt: t,
      },
      {
        subjectId: redeemer2Id,
        email: `${redeemer2Id}@t.test`,
        name: "R2",
        emailVerified: true,
        identityCreatedAt: t,
        replicatedAt: t,
      },
    ]);
    await db.insert(userInvitation).values({
      email,
      targetRole: "staff",
      targetStaffRole: "specialist",
      tokenHash,
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByUserId: inviterId,
      createdAt: t,
      updatedAt: t,
    });
  }

  it("redeems a single-use invite exactly once under concurrent registrations", async () => {
    await seedUsersAndInvite();

    const [a, b] = await Promise.all([
      repo.consumeForNewUser(tokenHash, redeemer1Id, email),
      repo.consumeForNewUser(tokenHash, redeemer2Id, email),
    ]);

    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(["invalid", "ok"]);

    const [row] = await db
      .select()
      .from(userInvitation)
      .where(eq(userInvitation.tokenHash, tokenHash))
      .limit(1);
    expect(row?.status).toBe("accepted");
    const winnerId = a.outcome === "ok" ? redeemer1Id : redeemer2Id;
    expect(row?.acceptedUserId).toBe(winnerId);

    const [winner] = await db
      .select()
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, winnerId))
      .limit(1);
    expect(winner?.role).toBe("staff");
    expect(winner?.staffRole).toBe("specialist");
  });

  it("rejects a second pending platform invite for the same email (partial unique index)", async () => {
    await seedUsersAndInvite();

    await expect(
      db.insert(userInvitation).values({
        // Uppercase to prove the index is case-insensitive (lower(email)).
        email: email.toUpperCase(),
        targetRole: "staff",
        targetStaffRole: "specialist",
        tokenHash: dupTokenHash,
        status: "pending",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdByUserId: inviterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "23505" });
  });
});
