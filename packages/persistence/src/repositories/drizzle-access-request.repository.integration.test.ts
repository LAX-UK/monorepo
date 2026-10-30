import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { accessRequest, legalEntity, legalEntityMember, user } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleAccessRequestRepository } from "./drizzle-access-request.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleAccessRequestRepository (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleAccessRequestRepository(db);
  const memberId = `access-member-${randomUUID()}`;
  const ownerId = `access-owner-${randomUUID()}`;
  const orgId = randomUUID();
  const now = new Date();

  beforeAll(async () => {
    for (const id of [memberId, ownerId]) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    await db.insert(legalEntity).values({
      id: orgId,
      displayName: "Access org",
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: ownerId,
      status: "approved",
    });
    await db.insert(legalEntityMember).values([
      { legalEntityId: orgId, userId: memberId, role: "viewer", acceptedAt: now },
      { legalEntityId: orgId, userId: ownerId, role: "owner", acceptedAt: now },
    ]);
  });

  afterAll(async () => {
    await db.delete(accessRequest).where(eq(accessRequest.legalEntityId, orgId));
    await db.delete(legalEntityMember).where(eq(legalEntityMember.legalEntityId, orgId));
    await db.delete(legalEntity).where(eq(legalEntity.id, orgId));
    await db.delete(user).where(inArray(user.id, [memberId, ownerId]));
  });

  const ask = {
    legalEntityId: orgId,
    requesterUserId: memberId,
    requestedRole: "buyer_agent" as const,
    requestedCapability: null,
    reason: "I bid at the Spring sale",
  };

  it("opens one pending request per ask, however often it is asked", async () => {
    const [a, b] = await Promise.all([repo.openOrFindPending(ask), repo.openOrFindPending(ask)]);
    expect(a?.row.id).toBe(b?.row.id);
    expect([a?.created, b?.created].filter(Boolean)).toHaveLength(1);
    const other = await repo.openOrFindPending({
      ...ask,
      requestedRole: null,
      requestedCapability: "entity.bid.place",
    });
    expect(other.created).toBe(true);
  });

  it("closes a pending request once, and a new ask opens again after", async () => {
    const { row } = await repo.openOrFindPending(ask);
    const closed = await repo.close(row.id, {
      status: "approved",
      decidedByUserId: ownerId,
      grantedRole: "buyer_agent",
    });
    expect(closed).toMatchObject({ status: "approved", grantedRole: "buyer_agent" });
    expect(await repo.close(row.id, { status: "declined", decidedByUserId: ownerId })).toBeNull();
    expect((await repo.openOrFindPending(ask)).created).toBe(true);
  });

  it("lists by account and requester, and finds only within the account", async () => {
    expect(
      (await repo.list({ legalEntityId: orgId, requesterUserId: memberId, limit: 10 })).length,
    ).toBeGreaterThan(0);
    expect(await repo.list({ legalEntityId: orgId, requesterUserId: ownerId, limit: 10 })).toEqual(
      [],
    );
    const [first] = await repo.list({ legalEntityId: orgId, requesterUserId: null, limit: 1 });
    expect(await repo.find(randomUUID(), first?.id ?? "")).toBeNull();
  });

  it("looks up an active membership", async () => {
    expect(await repo.activeMember(orgId, memberId)).toMatchObject({ role: "viewer" });
    expect(await repo.activeMember(orgId, "nobody")).toBeNull();
  });
});
