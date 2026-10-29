import type { Database } from "@auction/db";
import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import type { IIdentitySubjectClient } from "../interfaces/identity-issuer-client.js";
import { MemberPermissionError } from "../interfaces/member-management.js";
import type { LegalEntityMembershipGuard } from "../legal-entity-membership.guard.js";
import { InvitationInviteService } from "./invitation-invite.service.js";
import type { InvitationNotificationService } from "./invitation-notification.service.js";
import { InvitationTokenService } from "./invitation-token.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "user-admin";

function makeRepo(
  overrides: Partial<IEntityInvitationRepository> = {},
): IEntityInvitationRepository {
  const txRepo: IEntityInvitationRepository = {
    forConnection: () => txRepo,
    findUserIdByEmail: async () => null,
    userExistsByEmail: async () => false,
    hasActiveMember: async () => false,
    revokePendingForEntity: async () => {},
    insertInvitation: async () => {},
    findByTokenHash: async () => null,
    findById: async () => null,
    insertMember: async () => null,
    markInvitationAccepted: async () => {},
    markInvitationRevoked: async () => {},
    findUserName: async () => "Admin",
    findUserEmail: async () => "admin@example.com",
    findLegalEntityDisplayName: async () => "Org",
    findLegalEntityStatus: async () => "approved",
    ...overrides,
  };
  return {
    ...txRepo,
    forConnection: () => txRepo,
    ...overrides,
  };
}

function makeDb(): Database {
  return {
    transaction: async (fn: (tx: Database) => Promise<unknown>) => fn({} as Database),
  } as Database;
}

/** A membership guard that lets the actor through with `role`. */
function guardFor(role: LegalEntityMemberRole) {
  return {
    assertActorCan: vi.fn(async () => ({ id: "mem-actor", role })),
  } as unknown as LegalEntityMembershipGuard & {
    assertActorCan: ReturnType<typeof vi.fn>;
  };
}

function makePublisher() {
  return mockDomainEventSink(vi.fn(async () => {}));
}

describe("InvitationInviteService", () => {
  const tokenService = new InvitationTokenService();

  it("creates an invitation and sends notification", async () => {
    const insertInvitation = vi.fn(async () => {});
    const repo = makeRepo({
      insertInvitation,
      userExistsByEmail: async () => true,
    });
    const notifications = {
      notifyInviteSent: vi.fn(async () => {}),
    } as unknown as InvitationNotificationService;
    const guard = guardFor("admin");
    const service = new InvitationInviteService(
      transactionRunnerFromDb(makeDb()),
      repo,
      tokenService,
      notifications,
      makePublisher(),
      guard,
    );

    const result = await service.invite(ACTOR_ID, ENTITY_ID, {
      email: "new@example.com",
      role: "admin",
    });

    expect(guard.assertActorCan).toHaveBeenCalledWith(ACTOR_ID, ENTITY_ID, "entity.members.manage");
    expect(insertInvitation).toHaveBeenCalledOnce();
    expect(notifications.notifyInviteSent).toHaveBeenCalledOnce();
    expect(result.memberId).toBeNull();
    expect(result.invitationToken).toEqual(expect.any(String));
  });

  it("lets only an owner invite someone as an owner", async () => {
    const insertInvitation = vi.fn(async () => {});
    const build = (role: LegalEntityMemberRole) =>
      new InvitationInviteService(
        transactionRunnerFromDb(makeDb()),
        makeRepo({ insertInvitation }),
        tokenService,
        { notifyInviteSent: vi.fn() } as unknown as InvitationNotificationService,
        makePublisher(),
        guardFor(role),
      );

    await expect(
      build("admin").invite(ACTOR_ID, ENTITY_ID, { email: "new@example.com", role: "owner" }),
    ).rejects.toMatchObject({ code: "owner_only" });
    expect(insertInvitation).not.toHaveBeenCalled();

    await build("owner").invite(ACTOR_ID, ENTITY_ID, { email: "new@example.com", role: "owner" });
    expect(insertInvitation).toHaveBeenCalledOnce();
  });

  it("rejects inviting an existing active member", async () => {
    const repo = makeRepo({
      findUserIdByEmail: async () => "existing-user",
      hasActiveMember: async () => true,
    });
    const service = new InvitationInviteService(
      transactionRunnerFromDb(makeDb()),
      repo,
      tokenService,
      { notifyInviteSent: vi.fn() } as unknown as InvitationNotificationService,
      makePublisher(),
      guardFor("admin"),
    );

    await expect(
      service.invite(ACTOR_ID, ENTITY_ID, { email: "member@example.com", role: "admin" }),
    ).rejects.toBeInstanceOf(MemberPermissionError);
  });

  it("rejects an email-unverified Identity subject who is already a member", async () => {
    const hasActiveMember = vi.fn().mockResolvedValue(true);
    const service = new InvitationInviteService(
      transactionRunnerFromDb(makeDb()),
      makeRepo({ hasActiveMember }),
      tokenService,
      { notifyInviteSent: vi.fn() } as unknown as InvitationNotificationService,
      makePublisher(),
      guardFor("admin"),
      {
        findSubjectByEmail: vi.fn().mockResolvedValue({
          id: "unverified-user",
          email: "member@example.com",
          name: "Member",
          emailVerified: false,
          identityDisabledAt: null,
          mergedIntoSubjectId: null,
        }),
      } as unknown as IIdentitySubjectClient,
    );

    await expect(
      service.invite(ACTOR_ID, ENTITY_ID, { email: "member@example.com", role: "admin" }),
    ).rejects.toBeInstanceOf(MemberPermissionError);
    expect(hasActiveMember).toHaveBeenCalledWith(ENTITY_ID, "unverified-user");
  });

  it("routes an email-unverified Identity subject through existing-user notification", async () => {
    const notifications = {
      notifyInviteSent: vi.fn(async () => {}),
    } as unknown as InvitationNotificationService;
    const service = new InvitationInviteService(
      transactionRunnerFromDb(makeDb()),
      makeRepo(),
      tokenService,
      notifications,
      makePublisher(),
      guardFor("admin"),
      {
        findSubjectByEmail: vi.fn().mockResolvedValue({
          id: "unverified-user",
          email: "member@example.com",
          name: "Member",
          emailVerified: false,
          identityDisabledAt: null,
          mergedIntoSubjectId: null,
        }),
      } as unknown as IIdentitySubjectClient,
    );

    await service.invite(ACTOR_ID, ENTITY_ID, { email: "member@example.com", role: "admin" });

    expect(notifications.notifyInviteSent).toHaveBeenCalledWith(
      expect.objectContaining({ existingUser: true }),
    );
  });
});
