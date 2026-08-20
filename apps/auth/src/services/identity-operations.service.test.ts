import { hashPassword } from "@better-auth/utils/password";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IIdentityNotifier } from "./identity-notification.ports.js";
import type {
  IdentityEmailChangeRecord,
  IdentityOperationsRepositories,
  IdentitySubjectRecord,
} from "./identity-operations.ports.js";
import {
  IdentityOperationError,
  IdentityOperationsService,
  isCompensatableOrphan,
} from "./identity-operations.service.js";

const now = new Date("2026-08-10T00:15:00.000Z");
const transaction = { kind: "transaction" };
const subject: IdentitySubjectRecord = {
  id: "subject",
  email: "old@example.com",
  name: "Subject",
  emailVerified: true,
  identityDisabledAt: null,
  mergedIntoSubjectId: null,
};

function createRepositories(): IdentityOperationsRepositories {
  return {
    unitOfWork: {
      transaction: vi.fn(async (operation) => operation(transaction)),
    },
    subjects: {
      findById: vi.fn().mockResolvedValue(subject),
      findByEmail: vi.fn().mockResolvedValue(null),
      updateProfile: vi
        .fn()
        .mockResolvedValue({ id: "subject", name: "Updated Name", image: "https://cdn/image.jpg" }),
      markDeletionRequested: vi.fn().mockResolvedValue(true),
      cancelDeletionRequested: vi.fn().mockResolvedValue(true),
      lockForCompensation: vi
        .fn()
        .mockResolvedValue({ id: "subject", createdAt: new Date("2026-08-10T00:05:00.000Z") }),
      listAccountProviders: vi.fn().mockResolvedValue(["credential"]),
      deleteSubject: vi.fn().mockResolvedValue(true),
    },
    credentials: {
      listProviders: vi.fn().mockResolvedValue([]),
      findCredential: vi.fn().mockResolvedValue(null),
      insertCredential: vi.fn().mockResolvedValue("inserted"),
      updatePassword: vi.fn().mockResolvedValue(undefined),
    },
    sessions: {
      listForSubject: vi.fn().mockResolvedValue([]),
      findStamp: vi.fn().mockResolvedValue({ lastPasswordAuthAt: null }),
      stampPasswordAuth: vi.fn().mockResolvedValue(true),
      ownsSession: vi.fn().mockResolvedValue(true),
      deleteSession: vi.fn().mockResolvedValue(true),
      deleteAllSessions: vi.fn().mockResolvedValue(1),
      purgeSubjectSessionsAndTokens: vi.fn().mockResolvedValue(undefined),
    },
    emailChanges: {
      startChange: vi.fn().mockResolvedValue(undefined),
      readPending: vi.fn().mockResolvedValue("next@example.com"),
      clearPending: vi.fn().mockResolvedValue(undefined),
      loadForConfirmation: vi.fn().mockResolvedValue(null),
      markConfirmed: vi.fn().mockResolvedValue(undefined),
      findEmailOwner: vi.fn().mockResolvedValue(null),
      applyPendingEmail: vi.fn().mockResolvedValue(undefined),
    },
    verifications: {
      purgeExpired: vi.fn().mockResolvedValue(0),
    },
  };
}

function createService(repositories = createRepositories()) {
  const notifier: IIdentityNotifier = { passwordChanged: vi.fn().mockResolvedValue(undefined) };
  const productSubjectUsage = {
    getSubjectUsage: vi.fn().mockResolvedValue({
      hasProductProfile: false,
      hasExternalLink: false,
    }),
  };
  const identityEventPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
  const logout = {
    revokeIdentitySessions: vi.fn().mockResolvedValue(0),
    revokeSubject: vi.fn().mockResolvedValue(0),
  };
  return {
    repositories,
    notifier,
    productSubjectUsage,
    identityEventPublisher,
    logout,
    service: new IdentityOperationsService(
      repositories,
      notifier,
      productSubjectUsage,
      identityEventPublisher,
      logout,
      () => now,
    ),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("IdentityOperationsService", () => {
  it("rejects invalid input before touching storage", async () => {
    const { repositories, service } = createService();

    await expect(service.setupPassword("subject", "short")).rejects.toMatchObject({
      code: "invalid_password_policy",
    });
    await expect(
      service.startEmailChange("subject", "next@example.com", new Date("invalid")),
    ).rejects.toMatchObject({ code: "invalid_expiry" });

    expect(repositories.subjects.findById).not.toHaveBeenCalled();
  });

  it("maps missing subjects and duplicate credentials to stable errors", async () => {
    const missing = createRepositories();
    vi.mocked(missing.subjects.findById).mockResolvedValue(null);
    await expect(
      createService(missing).service.setupPassword("missing", "ValidPass123!"),
    ).rejects.toMatchObject({ code: "subject_not_found" });

    const duplicate = createRepositories();
    vi.mocked(duplicate.credentials.insertCredential).mockResolvedValue("already_set");
    await expect(
      createService(duplicate).service.setupPassword("subject", "ValidPass123!"),
    ).rejects.toMatchObject({ code: "already_set" });
  });

  it("publishes credential creation in the transaction, then revokes and notifies", async () => {
    const { service, repositories, identityEventPublisher, logout, notifier } = createService();

    await service.setupPassword("subject", "ValidPass123!", "current-session");

    expect(repositories.credentials.insertCredential).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ subjectId: "subject", now }),
    );
    expect(repositories.sessions.stampPasswordAuth).toHaveBeenCalledWith(transaction, {
      subjectId: "subject",
      sessionToken: "current-session",
      now,
      stepUp: false,
    });
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.credential_changed", userId: "subject", changeType: "create" },
      { transaction },
    );
    expect(logout.revokeSubject).toHaveBeenCalledWith("subject");
    expect(repositories.sessions.purgeSubjectSessionsAndTokens).toHaveBeenCalledWith(
      null,
      "subject",
    );
    expect(notifier.passwordChanged).toHaveBeenCalledWith({
      to: "old@example.com",
      subjectId: "subject",
      userName: "Subject",
    });
  });

  it("preserves credential and session step-up errors", async () => {
    const repositories = createRepositories();
    const { service } = createService(repositories);

    await expect(
      service.verifyPasswordAndStamp("subject", "password", "session"),
    ).rejects.toMatchObject({ code: "no_credential" });

    vi.mocked(repositories.credentials.findCredential).mockResolvedValue({
      id: "credential",
      passwordHash: await hashPassword("CorrectPass123!"),
    });
    await expect(
      service.verifyPasswordAndStamp("subject", "WrongPass123!", "session"),
    ).rejects.toMatchObject({ code: "invalid_password" });

    vi.mocked(repositories.sessions.stampPasswordAuth).mockResolvedValue(false);
    await expect(
      service.verifyPasswordAndStamp("subject", "CorrectPass123!", "session"),
    ).rejects.toMatchObject({ code: "no_session" });
  });

  it("rolls password changes back through the unit of work when the session is missing", async () => {
    const repositories = createRepositories();
    vi.mocked(repositories.credentials.findCredential).mockResolvedValue({
      id: "credential",
      passwordHash: await hashPassword("CurrentPass123!"),
    });
    vi.mocked(repositories.sessions.stampPasswordAuth).mockResolvedValue(false);
    const { service, identityEventPublisher } = createService(repositories);

    await expect(
      service.changePassword(
        "subject",
        "CurrentPass123!",
        "ReplacementPass123!",
        "missing-session",
      ),
    ).rejects.toMatchObject({ code: "no_session" });
    expect(identityEventPublisher.publish).not.toHaveBeenCalled();
  });

  it("publishes session revocation only after a deletion", async () => {
    const { service, repositories, identityEventPublisher } = createService();

    await expect(service.revokeSession("subject", "session")).resolves.toBe(true);
    expect(repositories.sessions.deleteSession).toHaveBeenCalledWith(
      transaction,
      "subject",
      "session",
    );
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      {
        type: "user.session_revoked",
        userId: "subject",
        sessionId: "session",
      },
      { transaction },
    );
  });

  it.each([
    {
      record: null,
      code: "subject_not_found",
    },
    {
      record: {
        email: "different@example.com",
        pendingNewEmail: "next@example.com",
        emailChangeExpiresAt: null,
      },
      code: "stale_flow",
    },
    {
      record: {
        email: "old@example.com",
        pendingNewEmail: "next@example.com",
        emailChangeExpiresAt: new Date("2026-08-09T00:00:00.000Z"),
      },
      code: "expired",
    },
  ])("preserves email confirmation error $code", async ({ record, code }) => {
    const repositories = createRepositories();
    vi.mocked(repositories.emailChanges.loadForConfirmation).mockResolvedValue(
      record
        ? ({
            name: "Subject",
            phoneNumber: null,
            emailChangeOldOk: false,
            emailChangeNewOk: false,
            ...record,
          } as IdentityEmailChangeRecord)
        : null,
    );
    const { service } = createService(repositories);

    await expect(
      service.confirmEmailChange({
        subjectId: "subject",
        oldEmail: "old@example.com",
        newEmail: "next@example.com",
        confirmFor: "old",
      }),
    ).rejects.toMatchObject({ code });
  });

  it("completes email change atomically and revokes after commit", async () => {
    const repositories = createRepositories();
    const before: IdentityEmailChangeRecord = {
      email: "old@example.com",
      name: "Subject",
      phoneNumber: "+971500000000",
      pendingNewEmail: "next@example.com",
      emailChangeOldOk: false,
      emailChangeNewOk: true,
      emailChangeExpiresAt: new Date("2026-08-11T00:00:00.000Z"),
    };
    vi.mocked(repositories.emailChanges.loadForConfirmation)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce({ ...before, emailChangeOldOk: true });
    const { service, identityEventPublisher, logout } = createService(repositories);

    await expect(
      service.confirmEmailChange({
        subjectId: "subject",
        oldEmail: "old@example.com",
        newEmail: "next@example.com",
        confirmFor: "old",
      }),
    ).resolves.toBe(true);
    expect(repositories.emailChanges.applyPendingEmail).toHaveBeenCalledWith(
      transaction,
      "subject",
      "next@example.com",
      now,
    );
    expect(repositories.sessions.purgeSubjectSessionsAndTokens).toHaveBeenCalledWith(
      transaction,
      "subject",
    );
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "user.profile_updated",
        userId: "subject",
        email: "next@example.com",
      }),
      expect.objectContaining({ transaction }),
    );
    expect(logout.revokeSubject).toHaveBeenCalledWith("subject");
  });

  it("rejects email completion when another subject owns the target", async () => {
    const repositories = createRepositories();
    const confirmed: IdentityEmailChangeRecord = {
      email: "old@example.com",
      name: "Subject",
      phoneNumber: null,
      pendingNewEmail: "next@example.com",
      emailChangeOldOk: true,
      emailChangeNewOk: true,
      emailChangeExpiresAt: null,
    };
    vi.mocked(repositories.emailChanges.loadForConfirmation).mockResolvedValue(confirmed);
    vi.mocked(repositories.emailChanges.findEmailOwner).mockResolvedValue("other");

    await expect(
      createService(repositories).service.confirmEmailChange({
        subjectId: "subject",
        oldEmail: "old@example.com",
        newEmail: "next@example.com",
        confirmFor: "old",
      }),
    ).rejects.toMatchObject({ code: "email_taken" });
  });

  it("guards orphan compensation and publishes deletion in the transaction", async () => {
    const repositories = createRepositories();
    const valid = createService(repositories);
    await expect(valid.service.deleteOrphanSubject("subject")).resolves.toBe(true);
    expect(valid.identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.identity_deleted", userId: "subject" },
      { transaction },
    );

    valid.productSubjectUsage.getSubjectUsage.mockResolvedValue({
      hasProductProfile: true,
      hasExternalLink: false,
    });
    await expect(valid.service.deleteOrphanSubject("subject")).rejects.toMatchObject({
      code: "not_orphan",
    });
  });

  it("fails orphan compensation closed before opening a transaction when product usage is unavailable", async () => {
    const repositories = createRepositories();
    const { productSubjectUsage, service } = createService(repositories);
    productSubjectUsage.getSubjectUsage.mockRejectedValue(new Error("product API unavailable"));

    await expect(service.deleteOrphanSubject("subject")).rejects.toMatchObject({
      code: "product_usage_unavailable",
    });
    expect(repositories.unitOfWork.transaction).not.toHaveBeenCalled();
    expect(repositories.subjects.deleteSubject).not.toHaveBeenCalled();
  });

  it("publishes the canonical profile including image in the state transaction", async () => {
    const repositories = createRepositories();
    const { service, identityEventPublisher } = createService(repositories);

    await service.updateSubjectProfile("subject", { name: "Updated Name" });
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      {
        type: "user.profile_updated",
        userId: "subject",
        name: "Updated Name",
        image: "https://cdn/image.jpg",
      },
      expect.objectContaining({ transaction }),
    );

    vi.mocked(repositories.subjects.updateProfile).mockResolvedValue(null);
    await expect(service.updateSubjectProfile("missing", { name: "Name" })).rejects.toBeInstanceOf(
      IdentityOperationError,
    );
  });

  it("publishes deletion request and cancellation in their state transactions", async () => {
    const repositories = createRepositories();
    const { service, identityEventPublisher } = createService(repositories);

    await service.markDeletionRequested("subject");
    expect(repositories.subjects.markDeletionRequested).toHaveBeenCalledWith(
      transaction,
      "subject",
      now,
    );
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.deletion_requested", userId: "subject", requestedAt: now },
      { producer: "apps/auth", transaction },
    );

    await service.cancelDeletionRequested("subject");
    expect(repositories.subjects.cancelDeletionRequested).toHaveBeenCalledWith(
      transaction,
      "subject",
      now,
    );
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.deletion_cancelled", userId: "subject", cancelledAt: now },
      { producer: "apps/auth", transaction },
    );
  });
});

describe("isCompensatableOrphan", () => {
  it("allows only a recent credential-only subject with no product links", () => {
    expect(
      isCompensatableOrphan({
        createdAt: new Date("2026-08-10T00:05:00.000Z"),
        accountProviderIds: ["credential"],
        hasProductProfile: false,
        hasExternalLink: false,
        now: now.getTime(),
      }),
    ).toBe(true);
  });

  it.each([
    { accountProviderIds: ["google"], hasProductProfile: false, hasExternalLink: false },
    { accountProviderIds: ["credential"], hasProductProfile: true, hasExternalLink: false },
    { accountProviderIds: ["credential"], hasProductProfile: false, hasExternalLink: true },
  ])("rejects linked or non-credential subjects", (input) => {
    expect(
      isCompensatableOrphan({
        createdAt: new Date("2026-08-10T00:05:00.000Z"),
        ...input,
        now: now.getTime(),
      }),
    ).toBe(false);
  });
});
