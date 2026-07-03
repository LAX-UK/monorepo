import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { IInvitationRepository } from "../../repositories/interfaces/invitation.repository.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import { MemberPermissionError } from "../interfaces/member-management.js";
import type { LegalEntityMembershipGuard } from "../legal-entity-membership.guard.js";
import { InvitationInviteService } from "./invitation-invite.service.js";
import type { InvitationNotificationService } from "./invitation-notification.service.js";
import { InvitationTokenService } from "./invitation-token.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "user-admin";

function makeRepo(overrides: Partial<IInvitationRepository> = {}): IInvitationRepository {
  const txRepo: IInvitationRepository = {
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

function makePublisher() {
  return { publish: vi.fn(async () => {}) } as unknown as DomainEventPublisher;
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
    const guard = {
      assertActorIsAdmin: vi.fn(async () => ({})),
    } as unknown as LegalEntityMembershipGuard;
    const service = new InvitationInviteService(
      makeDb(),
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

    expect(guard.assertActorIsAdmin).toHaveBeenCalledWith(ACTOR_ID, ENTITY_ID);
    expect(insertInvitation).toHaveBeenCalledOnce();
    expect(notifications.notifyInviteSent).toHaveBeenCalledOnce();
    expect(result.memberId).toBeNull();
    expect(result.invitationToken).toEqual(expect.any(String));
  });

  it("rejects inviting an existing active member", async () => {
    const repo = makeRepo({
      findUserIdByEmail: async () => "existing-user",
      hasActiveMember: async () => true,
    });
    const service = new InvitationInviteService(
      makeDb(),
      repo,
      tokenService,
      { notifyInviteSent: vi.fn() } as unknown as InvitationNotificationService,
      makePublisher(),
      { assertActorIsAdmin: vi.fn(async () => ({})) } as unknown as LegalEntityMembershipGuard,
    );

    await expect(
      service.invite(ACTOR_ID, ENTITY_ID, { email: "member@example.com", role: "admin" }),
    ).rejects.toBeInstanceOf(MemberPermissionError);
  });
});
