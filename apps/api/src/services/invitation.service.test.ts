import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailService } from "./interfaces/email.js";
import type { IUserInvitationRepository, InvitationRow } from "./interfaces/invitation.js";
import type { IUserRepository } from "./interfaces/repositories.js";
import { InvitationService } from "./invitation.service.js";

const SUPER_ADMIN = {
  id: "actor-1",
  email: "admin@example.com",
  name: "Admin",
  role: "staff",
  staffRole: "super_admin",
  image: null,
  hasSeenActingContextTooltip: false,
};

function makeInviteRow(overrides?: Partial<InvitationRow>): InvitationRow {
  return {
    id: "inv-1",
    email: "invitee@example.com",
    targetRole: "client",
    targetStaffRole: null,
    tokenHash: "hash",
    status: "pending",
    expiresAt: new Date(Date.now() + 86_400_000),
    openedAt: null,
    lastEmailOutboxId: null,
    acceptedAt: null,
    acceptedUserId: null,
    targetLegalEntityId: null,
    targetLegalEntityMemberRole: null,
    createdByUserId: "someone-else",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeps() {
  const invites = {
    insert: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findPendingByTokenHash: vi.fn().mockResolvedValue(null),
    findPendingPlatformByEmail: vi.fn().mockResolvedValue(null),
    consumeForNewUser: vi.fn(),
    listAdminCreatedBy: vi.fn().mockResolvedValue([]),
    countsForActor: vi.fn().mockResolvedValue({ total: 0, pending: 0 }),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    markOpenedFirstTouch: vi.fn().mockResolvedValue(undefined),
  } satisfies IUserInvitationRepository;

  const users = {
    findById: vi.fn().mockResolvedValue(SUPER_ADMIN),
    findByEmail: vi.fn().mockResolvedValue(null),
    listIdsByRole: vi.fn(),
    listStaffIdsForSubmissionNotifications: vi.fn(),
    listPublicProfiles: vi.fn(),
    updateActingContextTooltipSeen: vi.fn(),
  } as unknown as IUserRepository;

  const email = {
    enqueue: vi.fn().mockResolvedValue({ outboxId: "outbox-1" }),
  } as unknown as IEmailService;

  const svc = new InvitationService(invites, users, email, "https://web.test");
  return { svc, invites, users, email };
}

describe("InvitationService.create", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    deps = makeDeps();
  });

  it("rejects when actor lacks user.invite", async () => {
    vi.mocked(deps.users.findById).mockResolvedValue({
      ...SUPER_ADMIN,
      staffRole: "staff_viewer",
    });
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "x@example.com",
      targetRole: "client",
    });
    expect(res.isErr() && res.error.status).toBe(403);
    expect(deps.invites.insert).not.toHaveBeenCalled();
  });

  it("H1: rejects (409) when a user already exists for the email", async () => {
    vi.mocked(deps.users.findByEmail).mockResolvedValue({
      ...SUPER_ADMIN,
      id: "existing",
      email: "dupe@example.com",
    });
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "Dupe@Example.com",
      targetRole: "client",
    });
    expect(res.isErr() && res.error.status).toBe(409);
    expect(deps.users.findByEmail).toHaveBeenCalledWith("dupe@example.com");
    expect(deps.invites.insert).not.toHaveBeenCalled();
  });

  it("M2: rejects (409) when a pending platform invite already exists", async () => {
    vi.mocked(deps.invites.findPendingPlatformByEmail).mockResolvedValue(makeInviteRow());
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "invitee@example.com",
      targetRole: "client",
    });
    expect(res.isErr() && res.error.status).toBe(409);
    expect(deps.invites.insert).not.toHaveBeenCalled();
  });

  it("requires staffRole for staff invites", async () => {
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "s@example.com",
      targetRole: "staff",
    });
    expect(res.isErr() && res.error.status).toBe(400);
  });

  it("S3: rejects staffRole on a client invite", async () => {
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "c@example.com",
      targetRole: "client",
      targetStaffRole: "finance_ops",
    });
    expect(res.isErr() && res.error.status).toBe(400);
  });

  it("inserts, lowercases email, enqueues, and succeeds", async () => {
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "  New@Example.com ",
      targetRole: "staff",
      targetStaffRole: "finance_ops",
    });
    expect(res.isOk()).toBe(true);
    expect(deps.invites.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@example.com", targetStaffRole: "finance_ops" }),
    );
    expect(deps.email.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new@example.com", template: "invite" }),
    );
  });

  it("SC3: still succeeds when the invite email fails to enqueue", async () => {
    vi.mocked(deps.email.enqueue).mockRejectedValue(new Error("redis down"));
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "new@example.com",
      targetRole: "client",
    });
    expect(res.isOk()).toBe(true);
    expect(deps.invites.insert).toHaveBeenCalled();
  });

  it("M2: maps a unique-violation on insert to 409", async () => {
    vi.mocked(deps.invites.insert).mockRejectedValue({ code: "23505" });
    const res = await deps.svc.create({
      actorUserId: "actor-1",
      email: "new@example.com",
      targetRole: "client",
    });
    expect(res.isErr() && res.error.status).toBe(409);
  });
});

describe("InvitationService.revoke/resend (H2: not creator-scoped)", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    deps = makeDeps();
  });

  it("revoke succeeds for an invite created by a different admin", async () => {
    vi.mocked(deps.invites.findById).mockResolvedValue(
      makeInviteRow({ createdByUserId: "another-admin" }),
    );
    const res = await deps.svc.revoke({ actorUserId: "actor-1", invitationId: "inv-1" });
    expect(res.isOk()).toBe(true);
    expect(deps.invites.updateStatus).toHaveBeenCalledWith("inv-1", { status: "revoked" });
  });

  it("revoke returns 404 when missing", async () => {
    vi.mocked(deps.invites.findById).mockResolvedValue(null);
    const res = await deps.svc.revoke({ actorUserId: "actor-1", invitationId: "inv-x" });
    expect(res.isErr() && res.error.status).toBe(404);
  });

  it("revoke returns 400 when not pending", async () => {
    vi.mocked(deps.invites.findById).mockResolvedValue(makeInviteRow({ status: "accepted" }));
    const res = await deps.svc.revoke({ actorUserId: "actor-1", invitationId: "inv-1" });
    expect(res.isErr() && res.error.status).toBe(400);
  });

  it("resend succeeds for an invite created by a different admin and rotates the token", async () => {
    vi.mocked(deps.invites.findById).mockResolvedValue(
      makeInviteRow({ createdByUserId: "another-admin" }),
    );
    const res = await deps.svc.resend({ actorUserId: "actor-1", invitationId: "inv-1" });
    expect(res.isOk()).toBe(true);
    expect(deps.invites.updateStatus).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ tokenHash: expect.any(String) }),
    );
    expect(deps.email.enqueue).toHaveBeenCalled();
  });
});
