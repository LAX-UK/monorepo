import type { Database } from "@auction/db";
import type { IEntityInvitationRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import { InvitationAcceptanceService } from "./invitation-acceptance.service.js";
import type { InvitationNotificationService } from "./invitation-notification.service.js";
import { InvitationTokenService } from "./invitation-token.service.js";

const ENTITY_ID = "00000000-0000-4000-8000-000000000001";
const INVITE_ID = "00000000-0000-4000-8000-000000000010";
const USER_ID = "user-invitee";
const INVITER_ID = "user-inviter";

function pendingInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: INVITE_ID,
    email: "invitee@example.com",
    targetRole: "client" as const,
    targetStaffRole: null,
    tokenHash: "hash",
    status: "pending" as const,
    expiresAt: new Date(Date.now() + 86_400_000),
    openedAt: null,
    lastEmailOutboxId: null,
    acceptedAt: null,
    acceptedUserId: null,
    targetLegalEntityId: ENTITY_ID,
    targetLegalEntityMemberRole: "admin",
    createdByUserId: INVITER_ID,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const ACCEPTED_AT = new Date("2026-06-01T12:00:00.000Z");

function member() {
  return {
    id: "mem-1",
    legalEntityId: ENTITY_ID,
    userId: USER_ID,
    role: "admin" as const,
    isPrimaryAdmin: false,
    invitedByUserId: INVITER_ID,
    invitedAt: new Date("2026-01-01T00:00:00.000Z"),
    acceptedAt: ACCEPTED_AT,
    removedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

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
    findByTokenHash: async () => pendingInvite(),
    findById: async () => pendingInvite(),
    insertMember: async () => member(),
    markInvitationAccepted: async () => {},
    markInvitationRevoked: async () => {},
    findUserName: async () => "Invitee",
    findUserEmail: async () => "inviter@example.com",
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
  return mockDomainEventSink(vi.fn(async () => {}));
}

describe("InvitationAcceptanceService", () => {
  const tokenService = new InvitationTokenService();

  it("accepts a valid token invitation", async () => {
    const repo = makeRepo();
    const notifications = {
      notifyInviteAccepted: vi.fn(async () => {}),
    } as unknown as InvitationNotificationService;
    const service = new InvitationAcceptanceService(
      transactionRunnerFromDb(makeDb()),
      repo,
      tokenService,
      notifications,
      makePublisher(),
    );

    const result = await service.accept(USER_ID, "invitee@example.com", "raw-token");

    expect(result).toEqual({
      ok: true,
      kind: "accepted",
      legalEntityId: ENTITY_ID,
      member: member(),
    });
    expect(notifications.notifyInviteAccepted).toHaveBeenCalledOnce();
  });

  it("returns invitation_not_found when token is unknown", async () => {
    const repo = makeRepo({
      findByTokenHash: async () => null,
    });
    const service = new InvitationAcceptanceService(
      transactionRunnerFromDb(makeDb()),
      repo,
      tokenService,
      { notifyInviteAccepted: vi.fn() } as unknown as InvitationNotificationService,
      makePublisher(),
    );

    const result = await service.accept(USER_ID, "invitee@example.com", "missing");
    expect(result).toEqual({ ok: false, code: "invitation_not_found" });
  });

  it("declines a pending invitation", async () => {
    const repo = makeRepo();
    const notifications = {
      notifyInviteDeclined: vi.fn(async () => {}),
    } as unknown as InvitationNotificationService;
    const service = new InvitationAcceptanceService(
      transactionRunnerFromDb(makeDb()),
      repo,
      tokenService,
      notifications,
      makePublisher(),
    );

    const result = await service.decline(USER_ID, "invitee@example.com", INVITE_ID, "no thanks");

    expect(result).toEqual({ ok: true, kind: "declined" });
    expect(notifications.notifyInviteDeclined).toHaveBeenCalledOnce();
  });
});
