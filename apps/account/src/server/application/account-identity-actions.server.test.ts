import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = {
  rename: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  startEmailChange: vi.fn(),
  cancelEmailChange: vi.fn(),
  confirmEmailChange: vi.fn(),
  sendPhoneCode: vi.fn(),
  verifyPhone: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  requestDeletion: vi.fn(),
  cancelDeletion: vi.fn(),
};
const loadAccountRecord = vi.fn();

vi.mock("../container", () => ({ getLaxAccountContainer: () => ({ identity }) }));
vi.mock("./load-account-record", () => ({ loadAccountRecord: () => loadAccountRecord() }));

const {
  cancelAccountDeletionAction,
  cancelEmailChangeAction,
  confirmEmailChangeAction,
  regenerateBackupCodesAction,
  renameAccountAction,
  requestAccountDeletionAction,
  sendPhoneCodeAction,
  signOutDeviceAction,
  signOutOtherDevicesAction,
  startEmailChangeAction,
  verifyPhoneAction,
} = await import("./account-identity-actions.server");

const ACTOR = { accessToken: "access-token", sid: "current-sid" };

describe("account identity actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    loadAccountRecord.mockResolvedValue({ ...ACTOR, subject: "subject" });
  });

  it("renames as the signed-in person", async () => {
    identity.rename.mockResolvedValue({ status: "ok", value: "Ada King" });
    expect(await renameAccountAction("  Ada King ")).toEqual({
      status: "ok",
      message: "Your name has been updated.",
    });
    expect(identity.rename).toHaveBeenCalledWith(ACTOR, "Ada King");
  });

  it("refuses an empty or oversized name before calling the issuer", async () => {
    for (const name of ["   ", "a".repeat(201)]) {
      expect(await renameAccountAction(name)).toMatchObject({ status: "error" });
    }
    expect(identity.rename).not.toHaveBeenCalled();
  });

  it("signs out one device and all the others", async () => {
    identity.revokeSession.mockResolvedValue({ status: "ok", value: 1 });
    identity.revokeOtherSessions.mockResolvedValue({ status: "ok", value: 3 });
    expect(await signOutDeviceAction("other-sid")).toMatchObject({ status: "ok" });
    expect(identity.revokeSession).toHaveBeenCalledWith(ACTOR, "other-sid");
    expect(await signOutOtherDevicesAction()).toMatchObject({ status: "ok" });
    expect(identity.revokeOtherSessions).toHaveBeenCalledWith(ACTOR);
  });

  it("sends the person through a fresh sign-in when the issuer asks for one", async () => {
    identity.rename.mockResolvedValue({ status: "reauth_required" });
    identity.revokeSession.mockResolvedValue({ status: "reauth_required" });
    identity.revokeOtherSessions.mockResolvedValue({ status: "reauth_required" });
    expect(await renameAccountAction("Ada King")).toEqual({ status: "reauth_required" });
    expect(await signOutDeviceAction("other-sid")).toEqual({ status: "reauth_required" });
    expect(await signOutOtherDevicesAction()).toEqual({ status: "reauth_required" });
  });

  it("asks for a sign-in, without calling the issuer, when nobody is signed in", async () => {
    loadAccountRecord.mockResolvedValue(null);
    expect(await signOutOtherDevicesAction()).toEqual({ status: "reauth_required" });
    expect(identity.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it("says nothing changed when the issuer or the session store is unavailable", async () => {
    identity.revokeOtherSessions.mockResolvedValue({ status: "unavailable" });
    expect(await signOutOtherDevicesAction()).toMatchObject({
      status: "error",
      message: expect.stringContaining("Nothing was changed"),
    });
    loadAccountRecord.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await signOutOtherDevicesAction()).toMatchObject({ status: "error" });
  });

  describe("backup codes", () => {
    it("returns the new codes as the signed-in person", async () => {
      identity.regenerateBackupCodes.mockResolvedValue({ status: "ok", value: ["abcde-12345"] });
      expect(await regenerateBackupCodesAction()).toEqual({
        status: "ok",
        backupCodes: ["abcde-12345"],
      });
      expect(identity.regenerateBackupCodes).toHaveBeenCalledWith(ACTOR);
    });

    it("sends the person through a fresh sign-in when the issuer asks for one", async () => {
      identity.regenerateBackupCodes.mockResolvedValue({ status: "reauth_required" });
      expect(await regenerateBackupCodesAction()).toEqual({ status: "reauth_required" });
    });

    it("sends a signed-out person to sign in without calling the issuer", async () => {
      loadAccountRecord.mockResolvedValue(null);
      expect(await regenerateBackupCodesAction()).toEqual({ status: "reauth_required" });
      expect(identity.regenerateBackupCodes).not.toHaveBeenCalled();
    });

    it("explains when two-step verification is off", async () => {
      identity.regenerateBackupCodes.mockResolvedValue({
        status: "rejected",
        reason: "two_factor_not_enabled",
      });
      expect(await regenerateBackupCodesAction()).toEqual({
        status: "error",
        message: "Turn on two-step verification before creating backup codes.",
      });
    });

    it("says nothing changed when the issuer or the session store is unavailable", async () => {
      identity.regenerateBackupCodes.mockResolvedValue({ status: "unavailable" });
      expect(await regenerateBackupCodesAction()).toMatchObject({
        status: "error",
        message: expect.stringContaining("Nothing was changed"),
      });
      loadAccountRecord.mockRejectedValue(new Error("ECONNREFUSED"));
      expect(await regenerateBackupCodesAction()).toMatchObject({ status: "error" });
    });
  });

  describe("email change", () => {
    it("starts a change with the normalised address as the signed-in person", async () => {
      identity.startEmailChange.mockResolvedValue({ status: "ok", value: "new@example.com" });
      expect(await startEmailChangeAction("  New@Example.com ")).toMatchObject({ status: "ok" });
      expect(identity.startEmailChange).toHaveBeenCalledWith(ACTOR, "new@example.com");
    });

    it("refuses an address that is not one before calling the issuer", async () => {
      expect(await startEmailChangeAction("not-an-email")).toMatchObject({ status: "error" });
      expect(identity.startEmailChange).not.toHaveBeenCalled();
    });

    it("explains an address that is already in use", async () => {
      identity.startEmailChange.mockResolvedValue({ status: "rejected", reason: "email_taken" });
      expect(await startEmailChangeAction("taken@example.com")).toEqual({
        status: "error",
        message: "That email address is already used by another LAX account.",
      });
    });

    it("sends the person through a fresh sign-in when the issuer asks for one", async () => {
      identity.startEmailChange.mockResolvedValue({ status: "reauth_required" });
      identity.cancelEmailChange.mockResolvedValue({ status: "reauth_required" });
      expect(await startEmailChangeAction("new@example.com")).toEqual({
        status: "reauth_required",
      });
      expect(await cancelEmailChangeAction()).toEqual({ status: "reauth_required" });
    });

    it("cancels a change", async () => {
      identity.cancelEmailChange.mockResolvedValue({ status: "ok", value: true });
      expect(await cancelEmailChangeAction()).toMatchObject({ status: "ok" });
      expect(identity.cancelEmailChange).toHaveBeenCalledWith(ACTOR);
    });

    it("confirms from the emailed token without needing a session", async () => {
      loadAccountRecord.mockResolvedValue(null);
      identity.confirmEmailChange.mockResolvedValue({
        status: "ok",
        value: { completed: false, confirmedFor: "old" },
      });
      expect(await confirmEmailChangeAction("signed.token")).toEqual({
        status: "ok",
        completed: false,
        confirmedFor: "old",
      });
      expect(identity.confirmEmailChange).toHaveBeenCalledWith("signed.token");
      expect(loadAccountRecord).not.toHaveBeenCalled();
    });

    it.each([
      [{ status: "rejected", reason: "expired" }, "This link has expired"],
      [{ status: "rejected", reason: "invalid_token" }, "This link isn't valid"],
      [{ status: "unavailable" }, "Nothing was changed"],
    ])("explains a confirmation that fails (%j)", async (result, text) => {
      identity.confirmEmailChange.mockResolvedValue(result);
      expect(await confirmEmailChangeAction("t")).toMatchObject({
        status: "error",
        message: expect.stringContaining(text),
      });
    });

    it("does not call the issuer for an empty token", async () => {
      expect(await confirmEmailChangeAction("")).toMatchObject({ status: "error" });
      expect(identity.confirmEmailChange).not.toHaveBeenCalled();
    });
  });

  describe("phone", () => {
    it("sends a code to a valid international number", async () => {
      identity.sendPhoneCode.mockResolvedValue({ status: "ok", value: true });
      expect(await sendPhoneCodeAction("+447700900123")).toMatchObject({ status: "ok" });
      expect(identity.sendPhoneCode).toHaveBeenCalledWith(ACTOR, "+447700900123");
    });

    it("refuses a number without a country code before spending an SMS", async () => {
      expect(await sendPhoneCodeAction("07700900123")).toMatchObject({ status: "error" });
      expect(identity.sendPhoneCode).not.toHaveBeenCalled();
    });

    it("verifies the number with the code", async () => {
      identity.verifyPhone.mockResolvedValue({ status: "ok", value: "+447700900123" });
      expect(await verifyPhoneAction("+447700900123", "123456")).toMatchObject({ status: "ok" });
      expect(identity.verifyPhone).toHaveBeenCalledWith(ACTOR, "+447700900123", "123456");
    });

    it("refuses a malformed code before calling the issuer", async () => {
      expect(await verifyPhoneAction("+447700900123", "12ab")).toMatchObject({ status: "error" });
      expect(identity.verifyPhone).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid_code", "That code isn't right"],
      ["phone_taken", "already used by another LAX account"],
      ["rate_limited", "Too many attempts"],
    ] as const)("explains the %s refusal", async (reason, text) => {
      identity.verifyPhone.mockResolvedValue({ status: "rejected", reason });
      expect(await verifyPhoneAction("+447700900123", "123456")).toMatchObject({
        status: "error",
        message: expect.stringContaining(text),
      });
    });

    it("sends the person through a fresh sign-in when the issuer asks for one", async () => {
      identity.sendPhoneCode.mockResolvedValue({ status: "reauth_required" });
      expect(await sendPhoneCodeAction("+447700900123")).toEqual({ status: "reauth_required" });
    });
  });

  describe("deleting the account", () => {
    const PHRASE = "DELETE MY ACCOUNT";

    it("requests deletion as the signed-in person with the typed phrase", async () => {
      identity.requestDeletion.mockResolvedValue({
        status: "ok",
        value: { outcome: "requested", requestedAt: "2026-10-23T12:00:00.000Z" },
      });
      expect(await requestAccountDeletionAction(PHRASE)).toEqual({
        status: "ok",
        message: "Your account is scheduled for deletion.",
      });
      expect(identity.requestDeletion).toHaveBeenCalledWith(ACTOR, PHRASE);
    });

    it.each(["", "delete my account", "DELETE", "DELETE MY ACCOUNT "])(
      "refuses the phrase %j before calling the issuer",
      async (typed) => {
        expect(await requestAccountDeletionAction(typed)).toMatchObject({ status: "error" });
        expect(identity.requestDeletion).not.toHaveBeenCalled();
      },
    );

    it("reports a refusal as an error that points at the page, not as success", async () => {
      identity.requestDeletion.mockResolvedValue({
        status: "ok",
        value: { outcome: "not_eligible", status: { requestedAt: null, products: [] } },
      });
      expect(await requestAccountDeletionAction(PHRASE)).toEqual({
        status: "error",
        message:
          "Your account can't be deleted just now. What's in the way is listed on this page.",
      });
    });

    it("treats an already-requested deletion as done", async () => {
      identity.requestDeletion.mockResolvedValue({
        status: "ok",
        value: { outcome: "already_requested", requestedAt: "2026-10-01T09:00:00.000Z" },
      });
      expect(await requestAccountDeletionAction(PHRASE)).toMatchObject({ status: "ok" });
    });

    it("sends the person through a fresh sign-in when the issuer asks for one", async () => {
      identity.requestDeletion.mockResolvedValue({ status: "reauth_required" });
      expect(await requestAccountDeletionAction(PHRASE)).toEqual({ status: "reauth_required" });
    });

    it("asks for a sign-in, without calling the issuer, when nobody is signed in", async () => {
      loadAccountRecord.mockResolvedValue(null);
      expect(await requestAccountDeletionAction(PHRASE)).toEqual({ status: "reauth_required" });
      expect(identity.requestDeletion).not.toHaveBeenCalled();
    });

    it("says nothing changed when the issuer cannot be reached", async () => {
      identity.requestDeletion.mockResolvedValue({ status: "unavailable" });
      expect(await requestAccountDeletionAction(PHRASE)).toMatchObject({
        status: "error",
        message: expect.stringContaining("Nothing was changed"),
      });
    });

    it("cancels a deletion", async () => {
      identity.cancelDeletion.mockResolvedValue({ status: "ok", value: "cancelled" });
      expect(await cancelAccountDeletionAction()).toEqual({
        status: "ok",
        message: "Deletion cancelled. Your account stays as it is.",
      });
      expect(identity.cancelDeletion).toHaveBeenCalledWith(ACTOR);
    });

    it("says so when there was nothing to cancel", async () => {
      identity.cancelDeletion.mockResolvedValue({ status: "ok", value: "not_requested" });
      expect(await cancelAccountDeletionAction()).toMatchObject({
        status: "ok",
        message: "There was no deletion to cancel.",
      });
    });
  });
});
