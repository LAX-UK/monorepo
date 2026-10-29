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

  function serviceWith(repo: IEntityInvitationRepository, publish = vi.fn(async () => {})) {
    const notifications = {
      notifyInviteAccepted: vi.fn(async () => {}),
    } as unknown as InvitationNotificationService;
    return {
      notifications,
      publish,
      service: new InvitationAcceptanceService(
        transactionRunnerFromDb(makeDb()),
        repo,
        tokenService,
        notifications,
        mockDomainEventSink(publish),
      ),
    };
  }

  it("answers already_a_member when a concurrent accept added the person first", async () => {
    const markInvitationAccepted = vi.fn(async () => {});
    const { service, notifications, publish } = serviceWith(
      makeRepo({ insertMember: async () => null, markInvitationAccepted }),
    );

    const result = await service.accept(USER_ID, "invitee@example.com", "raw-token");

    expect(result).toEqual({ ok: false, code: "already_a_member" });
    expect(markInvitationAccepted).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(notifications.notifyInviteAccepted).not.toHaveBeenCalled();
  });

  it("answers already_a_member when the person accepts the same invitation again", async () => {
    const insertMember = vi.fn(async () => member());
    const { service } = serviceWith(
      makeRepo({
        findByTokenHash: async () =>
          pendingInvite({ status: "accepted", acceptedUserId: USER_ID, acceptedAt: ACCEPTED_AT }),
        insertMember,
      }),
    );

    await expect(service.accept(USER_ID, "invitee@example.com", "raw-token")).resolves.toEqual({
      ok: false,
      code: "already_a_member",
    });
    expect(insertMember).not.toHaveBeenCalled();
  });

  it.each(["restricted", "rejected", "archived"] as const)(
    "refuses to join a %s organisation and adds no member",
    async (status) => {
      const insertMember = vi.fn(async () => member());
      const markInvitationAccepted = vi.fn(async () => {});
      const { service, notifications } = serviceWith(
        makeRepo({
          findLegalEntityStatus: async () => status,
          insertMember,
          markInvitationAccepted,
        }),
      );

      await expect(service.accept(USER_ID, "invitee@example.com", "raw-token")).resolves.toEqual({
        ok: false,
        code:
          status === "restricted"
            ? "organisation_restricted_members"
            : "organisation_closed_to_members",
      });
      await expect(service.acceptById(USER_ID, "invitee@example.com", INVITE_ID)).resolves.toEqual({
        ok: false,
        code:
          status === "restricted"
            ? "organisation_restricted_members"
            : "organisation_closed_to_members",
      });
      expect(insertMember).not.toHaveBeenCalled();
      expect(markInvitationAccepted).not.toHaveBeenCalled();
      expect(notifications.notifyInviteAccepted).not.toHaveBeenCalled();
    },
  );

  it.each(["lead", "under_review", "connect_pending", "approved"] as const)(
    "still lets a person join a %s organisation",
    async (status) => {
      const { service } = serviceWith(makeRepo({ findLegalEntityStatus: async () => status }));
      const result = await service.accept(USER_ID, "invitee@example.com", "raw-token");
      expect(result.ok).toBe(true);
    },
  );

  it("still refuses an invitation someone else accepted", async () => {
    const { service } = serviceWith(
      makeRepo({
        findByTokenHash: async () =>
          pendingInvite({ status: "accepted", acceptedUserId: "someone-else" }),
      }),
    );
    await expect(service.accept(USER_ID, "invitee@example.com", "raw-token")).resolves.toEqual({
      ok: false,
      code: "invitation_not_pending",
    });
  });
});

describe("InvitationAcceptanceService.preview", () => {
  const tokenService = new InvitationTokenService();

  function preview(
    overrides: Partial<IEntityInvitationRepository> = {},
    email = "invitee@example.com",
  ) {
    const service = new InvitationAcceptanceService(
      transactionRunnerFromDb(makeDb()),
      makeRepo({ findLegalEntityDisplayName: async () => "Northbank Gallery", ...overrides }),
      tokenService,
      {} as InvitationNotificationService,
      makePublisher(),
    );
    return service.preview(USER_ID, email, "raw-token");
  }

  it("shows an open invitation with the organisation, role, inviter and expiry", async () => {
    const result = await preview();
    expect(result).toEqual({
      state: "open",
      legalEntityId: ENTITY_ID,
      organisationName: "Northbank Gallery",
      role: "admin",
      inviterName: "Invitee",
      expiresAt: expect.any(String),
    });
  });

  it("recognises someone who is already a member", async () => {
    await expect(preview({ hasActiveMember: async () => true })).resolves.toEqual({
      state: "already_member",
      legalEntityId: ENTITY_ID,
      organisationName: "Northbank Gallery",
    });
    await expect(
      preview({
        findByTokenHash: async () => pendingInvite({ status: "accepted", acceptedUserId: USER_ID }),
      }),
    ).resolves.toMatchObject({ state: "already_member" });
  });

  it("names the organisation of an expired invitation", async () => {
    await expect(
      preview({
        findByTokenHash: async () => pendingInvite({ expiresAt: new Date(Date.now() - 1) }),
      }),
    ).resolves.toEqual({ state: "expired", organisationName: "Northbank Gallery" });
  });

  it("calls an invitation to a restricted, rejected or archived organisation closed", async () => {
    for (const status of ["restricted", "rejected", "archived"] as const) {
      await expect(preview({ findLegalEntityStatus: async () => status })).resolves.toEqual({
        state: "closed",
      });
    }
  });

  it("calls a withdrawn, used or unknown invitation closed", async () => {
    await expect(
      preview({ findByTokenHash: async () => pendingInvite({ status: "revoked" }) }),
    ).resolves.toEqual({ state: "closed" });
    await expect(
      preview({
        findByTokenHash: async () =>
          pendingInvite({ status: "accepted", acceptedUserId: "someone-else" }),
      }),
    ).resolves.toEqual({ state: "closed" });
    await expect(preview({ findByTokenHash: async () => null })).resolves.toEqual({
      state: "closed",
    });
  });

  it("tells someone signed in with another email nothing about the organisation", async () => {
    const findLegalEntityDisplayName = vi.fn(async () => "Northbank Gallery");
    await expect(preview({ findLegalEntityDisplayName }, "someone@example.com")).resolves.toEqual({
      state: "other_email",
    });
    expect(findLegalEntityDisplayName).not.toHaveBeenCalled();
  });
});
