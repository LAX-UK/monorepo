import { createDb } from "@auction/db";
import { legalEntity, legalEntityMember, userInvitation } from "@auction/db/schema";
import { DrizzleEntityInvitationRepository } from "@auction/persistence/repositories";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { InvitationAcceptanceService } from "./invitation-acceptance.service.js";
import type { InvitationNotificationService } from "./invitation-notification.service.js";
import { InvitationTokenService } from "./invitation-token.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("accepting one invitation twice at once (integration)", () => {
  const inviterId = "inv_race_inviter";
  const inviteeId = "inv_race_invitee";
  const inviteeEmail = "inv-race-invitee@integration.test";
  const organisationId = "66666666-6666-4666-8666-666666666601";
  const token = "invitation-race-token-0001";

  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const tokens = new InvitationTokenService();
  const service = new InvitationAcceptanceService(
    transactionRunnerFromDb(db),
    new DrizzleEntityInvitationRepository(db),
    tokens,
    { notifyInviteAccepted: vi.fn(async () => {}) } as unknown as InvitationNotificationService,
    mockDomainEventSink(),
  );

  async function cleanup(): Promise<void> {
    await db.delete(userInvitation).where(eq(userInvitation.targetLegalEntityId, organisationId));
    await db.delete(legalEntityMember).where(eq(legalEntityMember.legalEntityId, organisationId));
    await db.delete(legalEntity).where(eq(legalEntity.id, organisationId));
    await deleteIdentityUserFixtures(db, [inviterId, inviteeId]);
  }

  async function seed(): Promise<void> {
    const now = new Date();
    await seedIdentityUserFixtures(db, [
      { id: inviterId, name: "Inviter", email: "inv-race-inviter@integration.test" },
      { id: inviteeId, name: "Invitee", email: inviteeEmail },
    ]);
    await db.insert(legalEntity).values({
      id: organisationId,
      displayName: "Race Gallery",
      kind: "organisation",
      subkind: "gallery",
      createdByUserId: inviterId,
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(userInvitation).values({
      email: inviteeEmail,
      targetRole: "client",
      tokenHash: tokens.hashToken(token),
      status: "pending",
      expiresAt: new Date(now.getTime() + 86_400_000),
      targetLegalEntityId: organisationId,
      targetLegalEntityMemberRole: "viewer",
      createdByUserId: inviterId,
    });
  }

  beforeEach(async () => {
    await cleanup();
    await seed();
  });

  afterAll(async () => {
    await cleanup();
  });

  it("adds the person once and tells the other accept they are already a member", async () => {
    const outcomes = await Promise.all([
      service.accept(inviteeId, inviteeEmail, token),
      service.accept(inviteeId, inviteeEmail, token),
    ]);

    const accepted = outcomes.filter((outcome) => outcome.ok);
    const refused = outcomes.filter((outcome) => !outcome.ok);
    expect(accepted).toHaveLength(1);
    expect(refused).toEqual([{ ok: false, code: "already_a_member" }]);

    const members = await db
      .select({ id: legalEntityMember.id })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, organisationId),
          eq(legalEntityMember.userId, inviteeId),
          isNull(legalEntityMember.removedAt),
        ),
      );
    expect(members).toHaveLength(1);
  });

  it("answers a later accept of the used invitation the same way", async () => {
    await expect(service.accept(inviteeId, inviteeEmail, token)).resolves.toMatchObject({
      ok: true,
    });
    await expect(service.accept(inviteeId, inviteeEmail, token)).resolves.toEqual({
      ok: false,
      code: "already_a_member",
    });
  });
});
