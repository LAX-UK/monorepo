import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  domainEvent,
  user,
  userInvitation,
} from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleUserInvitationRepository } from "./drizzle-invitation.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("invitation product grants (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const inviterId = `inv_grants_inviter_${run}`;
  const memberId = `inv_grants_member_${run}`;
  const memberEmail = `inv-grants-${run}@integration.test`;
  const subjects = [inviterId, memberId];

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleUserInvitationRepository(db);

  async function cleanup(): Promise<void> {
    await db.delete(userInvitation).where(sql`lower(${userInvitation.email}) = ${memberEmail}`);
    await db.delete(bidUserProfile).where(inArray(bidUserProfile.userId, subjects));
    await db.delete(bidIdentityDirectory).where(inArray(bidIdentityDirectory.subjectId, subjects));
    await db.delete(user).where(inArray(user.id, subjects));
  }

  async function seedUsers(): Promise<void> {
    const t = new Date();
    await db.insert(user).values(
      subjects.map((id) => ({
        id,
        name: id,
        email: id === memberId ? memberEmail : `${id}@t.test`,
        emailVerified: true,
        createdAt: t,
        updatedAt: t,
      })),
    );
    await db.insert(bidIdentityDirectory).values({
      subjectId: memberId,
      email: memberEmail,
      name: "Member",
      emailVerified: true,
      identityCreatedAt: t,
      replicatedAt: t,
    });
  }

  async function invite(
    grants: { product: "bid" | "shop"; role: string }[],
    targetRole: "staff" | "client",
  ) {
    const id = randomUUID();
    const tokenHash = `inv-grants-${run}-${id}`;
    await repo.insert({
      id,
      email: memberEmail,
      targetRole,
      targetStaffRole:
        (grants.find((g) => g.product === "bid")?.role as "specialist" | undefined) ?? null,
      tokenHash,
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
      acceptedAt: null,
      acceptedUserId: null,
      createdByUserId: inviterId,
      grants,
    });
    return { id, tokenHash };
  }

  async function grantedEvents(invitationId: string) {
    return db
      .select({ payload: domainEvent.payload, producer: domainEvent.producer })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, "lax.staff_access.granted"),
          sql`${domainEvent.payload}->>'invitationId' = ${invitationId}`,
        ),
      );
  }

  beforeEach(async () => {
    await cleanup();
    await seedUsers();
  });

  afterAll(cleanup);

  it("applies the Bid grant and emits a Shop grant event for an existing account", async () => {
    const { id, tokenHash } = await invite(
      [
        { product: "bid", role: "specialist" },
        { product: "shop", role: "broker" },
      ],
      "staff",
    );
    expect(await repo.listGrants(id)).toEqual([
      { product: "bid", role: "specialist" },
      { product: "shop", role: "broker" },
    ]);

    const result = await repo.acceptForExistingUser(tokenHash, memberId, memberEmail.toUpperCase());

    expect(result).toMatchObject({ outcome: "ok", targetRole: "staff" });
    const [profile] = await db
      .select({ role: bidUserProfile.role, staffRole: bidUserProfile.staffRole })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, memberId));
    expect(profile).toEqual({ role: "staff", staffRole: "specialist" });
    const events = await grantedEvents(id);
    expect(events).toEqual([
      {
        producer: "apps/api",
        payload: {
          schemaVersion: 1,
          subjectId: memberId,
          product: "shop",
          role: "broker",
          grantedBySubjectId: inviterId,
          invitationId: id,
        },
      },
    ]);
    const [row] = await db
      .select({ status: userInvitation.status, acceptedUserId: userInvitation.acceptedUserId })
      .from(userInvitation)
      .where(eq(userInvitation.id, id));
    expect(row).toEqual({ status: "accepted", acceptedUserId: memberId });
  });

  it("keeps a new user's Bid profile as client for a Shop-only invitation", async () => {
    const { id, tokenHash } = await invite([{ product: "shop", role: "finance" }], "client");

    const result = await repo.consumeForNewUser(tokenHash, memberId, memberEmail);

    expect(result).toMatchObject({ outcome: "ok", targetRole: "client" });
    const [profile] = await db
      .select({ role: bidUserProfile.role, staffRole: bidUserProfile.staffRole })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, memberId));
    expect(profile).toEqual({ role: "client", staffRole: null });
    expect(await grantedEvents(id)).toHaveLength(1);
  });

  it("leaves everything untouched when the email does not match", async () => {
    const { id, tokenHash } = await invite([{ product: "shop", role: "broker" }], "client");

    const result = await repo.acceptForExistingUser(tokenHash, memberId, "someone@else.test");

    expect(result).toEqual({ outcome: "email_mismatch" });
    expect(await grantedEvents(id)).toHaveLength(0);
    const [row] = await db
      .select({ status: userInvitation.status })
      .from(userInvitation)
      .where(eq(userInvitation.id, id));
    expect(row?.status).toBe("pending");
  });
});
