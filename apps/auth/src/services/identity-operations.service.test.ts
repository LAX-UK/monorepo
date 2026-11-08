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
      readSecurityStatus: vi.fn().mockResolvedValue({
        twoFactorEnabled: true,
        phoneNumber: "+442012345678",
        phoneNumberVerified: true,
        pendingNewEmail: null,
        emailChangeExpiresAt: null,
      }),
      updateProfile: vi
        .fn()
        .mockResolvedValue({ id: "subject", name: "Updated Name", image: "https://cdn/image.jpg" }),
      markDeletionRequested: vi.fn().mockResolvedValue(true),
      cancelDeletionRequested: vi.fn().mockResolvedValue(true),
      lockForCompensation: vi
        .fn()
        .mockResolvedValue({ id: "subject", createdAt: new Date("2026-08-10T00:05:00.000Z") }),
      listAccountProviders: vi.fn().mockResolvedValue(["credential"]),
      resetTwoFactorEnrollment: vi.fn().mockResolvedValue(true),
      deleteSubject: vi.fn().mockResolvedValue(true),
      setVerifiedPhone: vi.fn().mockResolvedValue("updated"),
      clearPhone: vi.fn().mockResolvedValue({ status: "cleared", previous: "+447700900123" }),
    },
    credentials: {
      listProviders: vi.fn().mockResolvedValue([]),
      listSignInAccounts: vi.fn().mockResolvedValue([]),
      lockSignInAccounts: vi.fn().mockResolvedValue([]),
      deleteSocialAccount: vi.fn().mockResolvedValue(true),
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
      deleteOtherSessions: vi.fn().mockResolvedValue(["other-1", "other-2"]),
      purgeSubjectSessionsAndTokens: vi.fn().mockResolvedValue(undefined),
    },
    emailChanges: {
      startChange: vi.fn().mockResolvedValue("started"),
      clearExpired: vi.fn().mockResolvedValue(0),
      readPending: vi.fn().mockResolvedValue({
        pendingNewEmail: "next@example.com",
        emailChangeExpiresAt: null,
      }),
      clearPending: vi.fn().mockResolvedValue(true),
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
  const notifier: IIdentityNotifier = {
    passwordChanged: vi.fn().mockResolvedValue(undefined),
    twoFactorResetBySupport: vi.fn().mockResolvedValue(undefined),
  };
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

  describe("pending email change", () => {
    it("refuses an address another person's live change is waiting on", async () => {
      const { repositories, service } = createService();
      vi.mocked(repositories.emailChanges.startChange).mockResolvedValue("address_pending");
      await expect(
        service.startEmailChange("subject", "next@example.com", new Date(now.getTime() + 1_000)),
      ).rejects.toMatchObject({ code: "email_taken" });
    });

    describe("staff-assisted start", () => {
      const expiresAt = new Date(now.getTime() + 60_000);

      it("records the change and counts the old inbox as confirmed", async () => {
        const { repositories, service } = createService();
        await service.startStaffAssistedEmailChange("subject", " Next@Example.com ", expiresAt);
        expect(repositories.emailChanges.startChange).toHaveBeenCalledWith(
          expect.objectContaining({ subjectId: "subject", newEmail: "next@example.com" }),
        );
        expect(repositories.emailChanges.markConfirmed).toHaveBeenCalledWith(
          transaction,
          "subject",
          "old",
          now,
        );
        expect(repositories.emailChanges.markConfirmed).not.toHaveBeenCalledWith(
          expect.anything(),
          "subject",
          "new",
          expect.anything(),
        );
      });

      it("vouches for nothing when the address is refused", async () => {
        const { repositories, service } = createService();
        vi.mocked(repositories.emailChanges.startChange).mockResolvedValue("address_pending");
        await expect(
          service.startStaffAssistedEmailChange("subject", "next@example.com", expiresAt),
        ).rejects.toMatchObject({ code: "email_taken" });
        expect(repositories.emailChanges.markConfirmed).not.toHaveBeenCalled();
      });
    });

    it("sweeps expired changes through the repository", async () => {
      const { repositories, service } = createService();
      vi.mocked(repositories.emailChanges.clearExpired).mockResolvedValue(3);
      await expect(service.purgeExpiredEmailChanges()).resolves.toBe(3);
      expect(repositories.emailChanges.clearExpired).toHaveBeenCalledWith(now);
    });

    const expired = new Date(now.getTime() - 1_000);
    const live = new Date(now.getTime() + 60_000);

    it("reports the address while the links are valid", async () => {
      const { repositories, service } = createService();
      vi.mocked(repositories.emailChanges.readPending).mockResolvedValue({
        pendingNewEmail: "next@example.com",
        emailChangeExpiresAt: live,
      });
      await expect(service.pendingEmailChange("subject")).resolves.toBe("next@example.com");
    });

    it("treats an expired change as none", async () => {
      const { repositories, service } = createService();
      vi.mocked(repositories.emailChanges.readPending).mockResolvedValue({
        pendingNewEmail: "next@example.com",
        emailChangeExpiresAt: expired,
      });
      await expect(service.pendingEmailChange("subject")).resolves.toBeNull();
    });

    it("lets a person clear an expired change", async () => {
      const { repositories, service } = createService();
      await service.cancelEmailChange("subject");
      expect(repositories.emailChanges.clearPending).toHaveBeenCalledWith("subject", now);
    });

    it("refuses a confirmation link once the pending change has been cancelled", async () => {
      const { repositories, service } = createService();
      await service.cancelEmailChange("subject");
      expect(repositories.emailChanges.clearPending).toHaveBeenCalledWith("subject", now);
      // With the pending address cleared, the link already emailed matches nothing.
      vi.mocked(repositories.emailChanges.loadForConfirmation).mockResolvedValue({
        name: "Subject",
        phoneNumber: null,
        email: "old@example.com",
        pendingNewEmail: null,
        emailChangeOldOk: true,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
      } as never);
      await expect(
        service.confirmEmailChange({
          subjectId: "subject",
          oldEmail: "old@example.com",
          newEmail: "next@example.com",
          confirmFor: "new",
        }),
      ).rejects.toMatchObject({ code: "stale_flow" });
      expect(repositories.emailChanges.markConfirmed).not.toHaveBeenCalled();
    });

    it("refuses to cancel when nothing is pending: never started, applied or already cancelled", async () => {
      const { repositories, service } = createService();
      vi.mocked(repositories.emailChanges.clearPending).mockResolvedValue(false);
      await expect(service.cancelEmailChange("subject")).rejects.toMatchObject({
        code: "none_in_progress",
      });
    });
  });

  it("reports breached passwords distinctly and fails open when the breach check is unknown", async () => {
    const repositories = createRepositories();
    const status = { value: "breached" as "breached" | "unknown" };
    const service = new IdentityOperationsService(
      repositories,
      {
        passwordChanged: vi.fn().mockResolvedValue(undefined),
        twoFactorResetBySupport: vi.fn().mockResolvedValue(undefined),
      },
      { getSubjectUsage: vi.fn() },
      { publish: vi.fn().mockResolvedValue(undefined) },
      undefined,
      () => now,
      { checkPassword: vi.fn(async () => ({ status: status.value })) },
    );

    await expect(service.setupPassword("subject", "Correct-horse-9")).rejects.toMatchObject({
      code: "password_breached",
    });
    expect(repositories.subjects.findById).not.toHaveBeenCalled();

    status.value = "unknown";
    vi.mocked(repositories.subjects.findById).mockResolvedValue(null);
    await expect(service.setupPassword("subject", "Correct-horse-9")).rejects.toMatchObject({
      code: "subject_not_found",
    });
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
      transaction,
      "subject",
    );
    expect(notifier.passwordChanged).toHaveBeenCalledWith({ subjectId: "subject" });
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

  describe("unlinkSocialSignIn", () => {
    const row = (providerId: string, hasPassword = false) => ({
      providerId,
      hasPassword,
      createdAt: new Date("2026-10-01T09:00:00Z"),
    });

    it("removes the provider, records it, and ends the other sessions in one transaction", async () => {
      const repositories = createRepositories();
      vi.mocked(repositories.credentials.lockSignInAccounts).mockResolvedValue([
        row("credential", true),
        row("google"),
      ]);
      const { service, identityEventPublisher } = createService(repositories);

      const outcome = await service.unlinkSocialSignIn("subject", "google", "current");

      expect(outcome).toEqual({ revokedSessionIds: ["other-1", "other-2"] });
      expect(repositories.credentials.deleteSocialAccount).toHaveBeenCalledWith(
        transaction,
        "subject",
        "google",
      );
      expect(repositories.sessions.deleteOtherSessions).toHaveBeenCalledWith(
        transaction,
        "subject",
        "current",
      );
      expect(identityEventPublisher.publish).toHaveBeenCalledWith(
        { type: "user.sign_in_method_unlinked", userId: "subject", provider: "google" },
        { transaction },
      );
      for (const sessionId of ["other-1", "other-2"]) {
        expect(identityEventPublisher.publish).toHaveBeenCalledWith(
          { type: "user.session_revoked", userId: "subject", sessionId },
          { transaction },
        );
      }
    });

    it("refuses the last method and changes nothing", async () => {
      const repositories = createRepositories();
      vi.mocked(repositories.credentials.lockSignInAccounts).mockResolvedValue([row("google")]);
      const { service, identityEventPublisher } = createService(repositories);

      await expect(
        service.unlinkSocialSignIn("subject", "google", "current"),
      ).rejects.toMatchObject({ code: "last_sign_in_method" });
      expect(repositories.credentials.deleteSocialAccount).not.toHaveBeenCalled();
      expect(repositories.sessions.deleteOtherSessions).not.toHaveBeenCalled();
      expect(identityEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("refuses a provider that is not linked", async () => {
      const repositories = createRepositories();
      vi.mocked(repositories.credentials.lockSignInAccounts).mockResolvedValue([
        row("credential", true),
      ]);
      const { service } = createService(repositories);

      await expect(service.unlinkSocialSignIn("subject", "apple", "current")).rejects.toMatchObject(
        {
          code: "not_linked",
        },
      );
      expect(repositories.credentials.deleteSocialAccount).not.toHaveBeenCalled();
    });
  });

  describe("changeAccountPassword", () => {
    const keep = { keepSessionId: "current" };

    it("changes the hash, ends the other sessions and records both in one transaction", async () => {
      const repositories = createRepositories();
      vi.mocked(repositories.credentials.findCredential).mockResolvedValue({
        id: "credential",
        passwordHash: await hashPassword("CurrentPass123!"),
      });
      const { service, identityEventPublisher } = createService(repositories);

      const outcome = await service.changeAccountPassword("subject", {
        currentPassword: "CurrentPass123!",
        newPassword: "ReplacementPass123!",
        ...keep,
      });

      expect(outcome).toEqual({ created: false, revokedSessionIds: ["other-1", "other-2"] });
      expect(repositories.credentials.updatePassword).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({ credentialId: "credential", subjectId: "subject" }),
      );
      expect(repositories.sessions.deleteOtherSessions).toHaveBeenCalledWith(
        transaction,
        "subject",
        "current",
      );
      expect(identityEventPublisher.publish).toHaveBeenCalledWith(
        { type: "user.credential_changed", userId: "subject", changeType: "update" },
        { transaction },
      );
      for (const sessionId of ["other-1", "other-2"]) {
        expect(identityEventPublisher.publish).toHaveBeenCalledWith(
          { type: "user.session_revoked", userId: "subject", sessionId },
          { transaction },
        );
      }
    });

    it("refuses a wrong current password without writing anything", async () => {
      const repositories = createRepositories();
      vi.mocked(repositories.credentials.findCredential).mockResolvedValue({
        id: "credential",
        passwordHash: await hashPassword("CurrentPass123!"),
      });
      const { service, identityEventPublisher } = createService(repositories);

      await expect(
        service.changeAccountPassword("subject", {
          currentPassword: "WrongPass123!!",
          newPassword: "ReplacementPass123!",
          ...keep,
        }),
      ).rejects.toMatchObject({ code: "invalid_password" });
      await expect(
        service.changeAccountPassword("subject", {
          currentPassword: null,
          newPassword: "ReplacementPass123!",
          ...keep,
        }),
      ).rejects.toMatchObject({ code: "invalid_password" });
      expect(repositories.credentials.updatePassword).not.toHaveBeenCalled();
      expect(repositories.sessions.deleteOtherSessions).not.toHaveBeenCalled();
      expect(identityEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("refuses a new password that equals the current one", async () => {
      const repositories = createRepositories();
      vi.mocked(repositories.credentials.findCredential).mockResolvedValue({
        id: "credential",
        passwordHash: await hashPassword("CurrentPass123!"),
      });
      const { service } = createService(repositories);

      await expect(
        service.changeAccountPassword("subject", {
          currentPassword: "CurrentPass123!",
          newPassword: "CurrentPass123!",
          ...keep,
        }),
      ).rejects.toMatchObject({ code: "same_password" });
      expect(repositories.credentials.updatePassword).not.toHaveBeenCalled();
    });

    it("applies the strength rules before reading the credential", async () => {
      const repositories = createRepositories();
      const { service } = createService(repositories);

      await expect(
        service.changeAccountPassword("subject", {
          currentPassword: "CurrentPass123!",
          newPassword: "short",
          ...keep,
        }),
      ).rejects.toMatchObject({ code: "invalid_password_policy" });
      expect(repositories.credentials.findCredential).not.toHaveBeenCalled();
    });

    it("sets a first password for an account with only a social or passkey login", async () => {
      const repositories = createRepositories();
      const { service, identityEventPublisher } = createService(repositories);

      const outcome = await service.changeAccountPassword("subject", {
        currentPassword: null,
        newPassword: "ReplacementPass123!",
        ...keep,
      });

      expect(outcome.created).toBe(true);
      expect(repositories.credentials.insertCredential).toHaveBeenCalledTimes(1);
      expect(repositories.credentials.updatePassword).not.toHaveBeenCalled();
      expect(identityEventPublisher.publish).toHaveBeenCalledWith(
        { type: "user.credential_changed", userId: "subject", changeType: "create" },
        { transaction },
      );
    });
  });

  it("commits session revocation before dispatching logout", async () => {
    const { service, repositories, identityEventPublisher, logout } = createService();

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
    expect(vi.mocked(repositories.sessions.deleteSession).mock.invocationCallOrder[0]).toBeLessThan(
      logout.revokeIdentitySessions.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not dispatch logout when the session transaction fails", async () => {
    const repositories = createRepositories();
    vi.mocked(repositories.sessions.deleteSession).mockRejectedValue(
      new Error("database unavailable"),
    );
    const { service, logout } = createService(repositories);

    await expect(service.revokeSession("subject", "session")).rejects.toThrow(
      "database unavailable",
    );
    expect(logout.revokeIdentitySessions).not.toHaveBeenCalled();
  });

  it("removes one session and records it without dispatching logout", async () => {
    const { service, identityEventPublisher, logout } = createService();

    await expect(service.removeSession("subject", "session")).resolves.toBe(true);
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.session_revoked", userId: "subject", sessionId: "session" },
      { transaction },
    );
    expect(logout.revokeIdentitySessions).not.toHaveBeenCalled();
  });

  it("records one revocation per removed session so the kept session is never signed out", async () => {
    const { service, repositories, identityEventPublisher } = createService();

    await expect(service.removeOtherSessions("subject", "keep")).resolves.toEqual([
      "other-1",
      "other-2",
    ]);
    expect(repositories.sessions.deleteOtherSessions).toHaveBeenCalledWith(
      transaction,
      "subject",
      "keep",
    );
    expect(identityEventPublisher.publish).toHaveBeenCalledTimes(2);
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.session_revoked", userId: "subject", sessionId: "other-2" },
      { transaction },
    );
  });

  it("dispatches subject logout only after revoke-all commits", async () => {
    const { service, repositories, logout } = createService();

    await expect(service.revokeAllSessions("subject")).resolves.toBe(1);
    expect(
      vi.mocked(repositories.sessions.deleteAllSessions).mock.invocationCallOrder[0],
    ).toBeLessThan(logout.revokeSubject.mock.invocationCallOrder[0] ?? 0);
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

  it("stores a verified phone and publishes it with the profile in one transaction", async () => {
    const repositories = createRepositories();
    const { service, identityEventPublisher } = createService(repositories);

    await service.setVerifiedPhone("subject", "+447700900123");

    expect(repositories.subjects.setVerifiedPhone).toHaveBeenCalledWith(
      transaction,
      "subject",
      "+447700900123",
      now,
    );
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      {
        type: "user.profile_updated",
        userId: "subject",
        phone: "+447700900123",
        phoneVerified: true,
      },
      { producer: "apps/auth", transaction },
    );
  });

  it.each(["phone_taken", "not_found"] as const)(
    "publishes nothing when the phone is %s",
    async (outcome) => {
      const repositories = createRepositories();
      vi.mocked(repositories.subjects.setVerifiedPhone).mockResolvedValue(outcome);
      const { service, identityEventPublisher } = createService(repositories);

      await expect(service.setVerifiedPhone("subject", "+447700900123")).rejects.toMatchObject({
        code: outcome === "phone_taken" ? "phone_taken" : "subject_not_found",
      });
      expect(identityEventPublisher.publish).not.toHaveBeenCalled();
    },
  );

  it("clears the phone and publishes the cleared profile in one transaction", async () => {
    const repositories = createRepositories();
    const { service, identityEventPublisher } = createService(repositories);

    expect(await service.clearPhone("subject")).toBe("+447700900123");

    expect(repositories.subjects.clearPhone).toHaveBeenCalledWith(transaction, "subject", now);
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.profile_updated", userId: "subject", phone: null, phoneVerified: false },
      { producer: "apps/auth", transaction },
    );
  });

  it("reports no phone and publishes nothing when there was none", async () => {
    const repositories = createRepositories();
    vi.mocked(repositories.subjects.clearPhone).mockResolvedValue({ status: "no_phone" });
    const { service, identityEventPublisher } = createService(repositories);

    expect(await service.clearPhone("subject")).toBeNull();
    expect(identityEventPublisher.publish).not.toHaveBeenCalled();
  });

  it("fails when the subject does not exist", async () => {
    const repositories = createRepositories();
    vi.mocked(repositories.subjects.clearPhone).mockResolvedValue({ status: "not_found" });
    const { service, identityEventPublisher } = createService(repositories);

    await expect(service.clearPhone("subject")).rejects.toMatchObject({
      code: "subject_not_found",
    });
    expect(identityEventPublisher.publish).not.toHaveBeenCalled();
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

describe("resetTwoFactor", () => {
  it("clears enrollment and deletes sessions in one transaction, then fans out logout", async () => {
    const { repositories, service, logout, identityEventPublisher, notifier } = createService();
    await service.resetTwoFactor("subject");
    expect(notifier.twoFactorResetBySupport).toHaveBeenCalledWith({ subjectId: "subject" });
    expect(repositories.unitOfWork.transaction).toHaveBeenCalledTimes(1);
    expect(repositories.subjects.resetTwoFactorEnrollment).toHaveBeenCalledWith(
      transaction,
      "subject",
      expect.any(Date),
    );
    expect(repositories.sessions.deleteAllSessions).toHaveBeenCalledWith(transaction, "subject");
    expect(identityEventPublisher.publish).toHaveBeenCalledWith(
      { type: "user.session_revoked", userId: "subject" },
      { transaction },
    );
    expect(identityEventPublisher.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "user.credential_changed" }),
      expect.anything(),
    );
    expect(logout.revokeSubject).toHaveBeenCalledWith("subject");
  });

  it("still fans out RP logout when the subject has no IdP sessions", async () => {
    const { repositories, service, logout, identityEventPublisher } = createService();
    vi.mocked(repositories.sessions.deleteAllSessions).mockResolvedValue(0);
    await service.resetTwoFactor("subject");
    expect(identityEventPublisher.publish).not.toHaveBeenCalled();
    expect(logout.revokeSubject).toHaveBeenCalledWith("subject");
  });

  it("rejects unknown subjects without revoking anything", async () => {
    const { repositories, service, logout, notifier } = createService();
    vi.mocked(repositories.subjects.resetTwoFactorEnrollment).mockResolvedValue(false);
    await expect(service.resetTwoFactor("missing")).rejects.toMatchObject({
      code: "subject_not_found",
    });
    expect(notifier.twoFactorResetBySupport).not.toHaveBeenCalled();
    expect(repositories.sessions.deleteAllSessions).not.toHaveBeenCalled();
    expect(logout.revokeSubject).not.toHaveBeenCalled();
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
