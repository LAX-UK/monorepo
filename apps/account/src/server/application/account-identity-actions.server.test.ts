import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = {
  rename: vi.fn(),
  setTimeZone: vi.fn(),
  reportDeviceZone: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  startEmailChange: vi.fn(),
  cancelEmailChange: vi.fn(),
  confirmEmailChange: vi.fn(),
  sendPhoneCode: vi.fn(),
  verifyPhone: vi.fn(),
  removePhone: vi.fn(),
  changePassword: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  unlinkSignInMethod: vi.fn(),
  renamePasskey: vi.fn(),
  removePasskey: vi.fn(),
  startSignInMethodAction: vi.fn(),
  requestDeletion: vi.fn(),
  cancelDeletion: vi.fn(),
};
const loadAccountRecord = vi.fn();

vi.mock("../container", () => ({ getLaxAccountContainer: () => ({ identity }) }));
vi.mock("./load-account-record", () => ({ loadAccountRecord: () => loadAccountRecord() }));

const {
  cancelAccountDeletionAction,
  cancelEmailChangeAction,
  changePasswordAction,
  confirmEmailChangeAction,
  regenerateBackupCodesAction,
  removePasskeyAction,
  removeSignInMethodAction,
  renameAccountAction,
  renamePasskeyAction,
  reportDeviceZoneAction,
  requestAccountDeletionAction,
  saveTimeZoneAction,
  sendPhoneCodeAction,
  signOutDeviceAction,
  signOutOtherDevicesAction,
  startEmailChangeAction,
  startSignInMethodAddAction,
  removePhoneAction,
  verifyPhoneAction,
} = await import("./account-identity-actions.server");

const ACTOR = { accessToken: "access-token", sid: "current-sid" };

describe("account identity actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    loadAccountRecord.mockResolvedValue({ ...ACTOR, subject: "subject" });
  });

  describe("saveTimeZoneAction", () => {
    it("saves always-use-one-city for the signed-in person", async () => {
      identity.setTimeZone.mockResolvedValue({
        status: "ok",
        value: { mode: "fixed", zone: "Asia/Tokyo" },
      });
      expect(await saveTimeZoneAction({ mode: "fixed", zone: "Asia/Tokyo" })).toEqual({
        status: "ok",
        mode: "fixed",
        zone: "Asia/Tokyo",
      });
      expect(identity.setTimeZone).toHaveBeenCalledWith(ACTOR, {
        mode: "fixed",
        zone: "Asia/Tokyo",
      });
    });

    it("saves Automatic with the device's zone, or none when it reports none", async () => {
      identity.setTimeZone.mockResolvedValue({
        status: "ok",
        value: { mode: "automatic", zone: null },
      });
      await saveTimeZoneAction({ mode: "automatic", zone: "UTC" });
      expect(identity.setTimeZone).toHaveBeenCalledWith(ACTOR, {
        mode: "automatic",
        deviceZone: null,
      });
    });

    it.each(["UTC", "Etc/GMT+2", "Nowhere/City", null])(
      "refuses %s as a fixed zone without calling the issuer",
      async (zone) => {
        expect(await saveTimeZoneAction({ mode: "fixed", zone })).toEqual({
          status: "error",
          message: "Choose a city, such as London or New York.",
        });
        expect(identity.setTimeZone).not.toHaveBeenCalled();
      },
    );

    it("sends a person whose sign-in has ended to sign in again", async () => {
      loadAccountRecord.mockResolvedValue(null);
      expect(await saveTimeZoneAction({ mode: "fixed", zone: "Asia/Tokyo" })).toEqual({
        status: "reauth_required",
      });
    });

    it("says nothing was changed when the issuer is unavailable", async () => {
      identity.setTimeZone.mockResolvedValue({ status: "unavailable" });
      expect(await saveTimeZoneAction({ mode: "fixed", zone: "Asia/Tokyo" })).toMatchObject({
        status: "error",
        message: expect.stringContaining("Nothing was changed"),
      });
    });
  });

  describe("reportDeviceZoneAction", () => {
    it("tells the issuer the device's zone and answers with what is stored", async () => {
      identity.reportDeviceZone.mockResolvedValue({ mode: "automatic", zone: "Asia/Tokyo" });
      expect(await reportDeviceZoneAction("Asia/Tokyo")).toEqual({
        status: "ok",
        mode: "automatic",
        zone: "Asia/Tokyo",
      });
      expect(identity.reportDeviceZone).toHaveBeenCalledWith(ACTOR, "Asia/Tokyo");
    });

    it("is an error when the issuer cannot be reached", async () => {
      identity.reportDeviceZone.mockResolvedValue(null);
      expect((await reportDeviceZoneAction("Asia/Tokyo")).status).toBe("error");
    });
  });

  describe("startSignInMethodAddAction", () => {
    const URL_OK = "https://auth.example.com/account-action?ticket=abc";

    it("asks the issuer to add the provider as the signed-in person and returns its address", async () => {
      identity.startSignInMethodAction.mockResolvedValue({ status: "ok", value: { url: URL_OK } });
      expect(await startSignInMethodAddAction("google")).toEqual({ status: "ok", url: URL_OK });
      expect(identity.startSignInMethodAction).toHaveBeenCalledWith(ACTOR, "google");
    });

    it("asks the issuer to add a passkey the same way", async () => {
      identity.startSignInMethodAction.mockResolvedValue({ status: "ok", value: { url: URL_OK } });
      expect(await startSignInMethodAddAction("passkey")).toEqual({ status: "ok", url: URL_OK });
      expect(identity.startSignInMethodAction).toHaveBeenCalledWith(ACTOR, "passkey");
    });

    it("refuses anything that is not a way to sign in before calling the issuer", async () => {
      for (const kind of ["credential", "", "GOOGLE", "password"]) {
        expect(await startSignInMethodAddAction(kind)).toMatchObject({ status: "error" });
      }
      expect(identity.startSignInMethodAction).not.toHaveBeenCalled();
    });

    it("says at the limit that there are already ten passkeys", async () => {
      identity.startSignInMethodAction.mockResolvedValue({
        status: "rejected",
        reason: "passkey_limit",
      });
      expect(await startSignInMethodAddAction("passkey")).toEqual({
        status: "error",
        message: "You have 10 passkeys, the most an account can have. Remove one to add another.",
        refresh: false,
      });
    });

    it("sends the person through a fresh sign-in when theirs is too old or ended", async () => {
      identity.startSignInMethodAction.mockResolvedValue({ status: "reauth_required" });
      expect(await startSignInMethodAddAction("apple")).toEqual({ status: "reauth_required" });
      loadAccountRecord.mockResolvedValue(null);
      expect(await startSignInMethodAddAction("apple")).toEqual({ status: "reauth_required" });
    });

    it("tells a staff account why there is no link, and does not ask for a refresh", async () => {
      identity.startSignInMethodAction.mockResolvedValue({
        status: "rejected",
        reason: "staff_not_allowed",
      });
      expect(await startSignInMethodAddAction("google")).toEqual({
        status: "error",
        message: "Staff accounts can't sign in with Google or Apple. Add a passkey instead.",
        refresh: false,
      });
    });

    it("asks for a refresh when the page was out of date", async () => {
      for (const reason of ["already_linked", "not_available"] as const) {
        identity.startSignInMethodAction.mockResolvedValue({ status: "rejected", reason });
        expect(await startSignInMethodAddAction("google")).toMatchObject({
          status: "error",
          refresh: true,
        });
      }
    });

    it("says nothing changed when the issuer could not answer", async () => {
      identity.startSignInMethodAction.mockResolvedValue({ status: "unavailable" });
      expect(await startSignInMethodAddAction("google")).toEqual({
        status: "error",
        message: expect.stringContaining("Nothing was changed"),
        refresh: false,
      });
    });
  });

  describe("removePasskeyAction", () => {
    it("removes the passkey as the signed-in person and says it emailed them", async () => {
      identity.removePasskey.mockResolvedValue({
        status: "ok",
        value: { removed: true, revokedSessions: 1 },
      });
      expect(await removePasskeyAction("pk-1")).toEqual({
        status: "ok",
        message: "Passkey removed. We've emailed you to confirm.",
      });
      expect(identity.removePasskey).toHaveBeenCalledWith(ACTOR, "pk-1");
    });

    it("acts for nobody when the person is not signed in", async () => {
      loadAccountRecord.mockResolvedValue(null);
      expect(await removePasskeyAction("pk-1")).toEqual({ status: "reauth_required" });
      expect(identity.removePasskey).not.toHaveBeenCalled();
    });

    it("sends the person through a fresh sign-in when theirs is too old", async () => {
      identity.removePasskey.mockResolvedValue({ status: "reauth_required" });
      expect(await removePasskeyAction("pk-1")).toEqual({ status: "reauth_required" });
    });

    it("explains the last-way-in refusal and a passkey that is already gone", async () => {
      identity.removePasskey.mockResolvedValue({
        status: "rejected",
        reason: "last_sign_in_method",
      });
      expect(await removePasskeyAction("pk-1")).toEqual({
        status: "error",
        message:
          "This is the only way you can sign in. Add a passkey or a password first, then you can remove it.",
        stale: true,
      });
      identity.removePasskey.mockResolvedValue({ status: "rejected", reason: "not_linked" });
      expect(await removePasskeyAction("pk-1")).toMatchObject({ status: "error" });
    });

    it("marks a refusal that means the page was out of date, and words a gone passkey as one", async () => {
      identity.removePasskey.mockResolvedValue({
        status: "rejected",
        reason: "last_sign_in_method",
      });
      expect(await removePasskeyAction("pk-1")).toMatchObject({ status: "error", stale: true });
      identity.removePasskey.mockResolvedValue({ status: "rejected", reason: "not_linked" });
      expect(await removePasskeyAction("pk-1")).toEqual({
        status: "error",
        message: "That passkey isn't on your account any more.",
        stale: true,
      });
    });

    it("refuses a crafted id cleanly, without calling the issuer", async () => {
      for (const bad of ["", "x".repeat(129), 42 as never, null as never]) {
        expect(await removePasskeyAction(bad)).toMatchObject({ status: "error" });
        expect(await renamePasskeyAction(bad, "Mine")).toMatchObject({ status: "error" });
      }
      expect(await renamePasskeyAction("pk-1", { toString: () => "x" } as never)).toMatchObject({
        status: "error",
      });
      expect(identity.removePasskey).not.toHaveBeenCalled();
      expect(identity.renamePasskey).not.toHaveBeenCalled();
    });

    it("says nothing was changed when the issuer could not answer, and needs a passkey id", async () => {
      identity.removePasskey.mockResolvedValue({ status: "unavailable" });
      expect(await removePasskeyAction("pk-1")).toMatchObject({
        status: "error",
        message: expect.stringContaining("Nothing was changed"),
      });
      identity.removePasskey.mockClear();
      expect(await removePasskeyAction("")).toMatchObject({ status: "error" });
      expect(identity.removePasskey).not.toHaveBeenCalled();
    });
  });

  describe("renamePasskeyAction", () => {
    it("renames with the trimmed name as the signed-in person", async () => {
      identity.renamePasskey.mockResolvedValue({ status: "ok", value: { id: "pk-1" } });
      expect(await renamePasskeyAction("pk-1", "  Studio iMac ")).toEqual({
        status: "ok",
        message: "Passkey renamed.",
      });
      expect(identity.renamePasskey).toHaveBeenCalledWith(ACTOR, "pk-1", "Studio iMac");
    });

    it("checks the name before calling the issuer, saying what is wrong with it", async () => {
      expect(await renamePasskeyAction("pk-1", "   ")).toEqual({
        status: "error",
        message: "Enter a name for this passkey.",
      });
      expect(await renamePasskeyAction("pk-1", "x".repeat(41))).toEqual({
        status: "error",
        message: "Use 40 characters or fewer.",
      });
      expect(await renamePasskeyAction("pk-1", "one\ntwo")).toMatchObject({ status: "error" });
      expect(await renamePasskeyAction("pk-1", "a\u202Eb")).toMatchObject({ status: "error" });
      expect(identity.renamePasskey).not.toHaveBeenCalled();
    });

    it("reports a passkey that is not the person's as no longer there", async () => {
      identity.renamePasskey.mockResolvedValue({ status: "rejected", reason: "not_linked" });
      expect(await renamePasskeyAction("pk-9", "Mine")).toMatchObject({ status: "error" });
    });

    it("sends a person who is not signed in through a fresh sign-in", async () => {
      loadAccountRecord.mockResolvedValue(null);
      expect(await renamePasskeyAction("pk-1", "Mine")).toEqual({ status: "reauth_required" });
    });
  });

  describe("removeSignInMethodAction", () => {
    it("removes the provider as the signed-in person and says every other device was signed out", async () => {
      identity.unlinkSignInMethod.mockResolvedValue({
        status: "ok",
        value: { unlinked: "google", revokedSessions: 2 },
      });
      expect(await removeSignInMethodAction("google")).toEqual({
        status: "ok",
        message: "Google sign-in has been removed. Every other device has been signed out.",
      });
      expect(identity.unlinkSignInMethod).toHaveBeenCalledWith(ACTOR, "google");
    });

    it("refuses an unknown provider before calling the issuer", async () => {
      expect(await removeSignInMethodAction("credential")).toMatchObject({ status: "error" });
      expect(identity.unlinkSignInMethod).not.toHaveBeenCalled();
    });

    it("explains the last-method refusal", async () => {
      identity.unlinkSignInMethod.mockResolvedValue({
        status: "rejected",
        reason: "last_sign_in_method",
      });
      expect(await removeSignInMethodAction("google")).toEqual({
        status: "error",
        message: expect.stringContaining("only way you can sign in"),
        stale: true,
      });
    });

    it("sends the person through a fresh sign-in when theirs is too old", async () => {
      identity.unlinkSignInMethod.mockResolvedValue({ status: "reauth_required" });
      expect(await removeSignInMethodAction("apple")).toEqual({ status: "reauth_required" });
    });

    it("sends the person to sign in when they have no session", async () => {
      loadAccountRecord.mockResolvedValue(null);
      expect(await removeSignInMethodAction("apple")).toEqual({ status: "reauth_required" });
      expect(identity.unlinkSignInMethod).not.toHaveBeenCalled();
    });

    it("reports an unreachable issuer as a retryable failure", async () => {
      identity.unlinkSignInMethod.mockResolvedValue({ status: "unavailable" });
      expect(await removeSignInMethodAction("google")).toMatchObject({ status: "error" });
    });
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

    it("removes the number as the signed-in person", async () => {
      identity.removePhone.mockResolvedValue({ status: "ok", value: true });
      expect(await removePhoneAction()).toEqual({
        status: "ok",
        message: "Your phone number has been removed.",
      });
      expect(identity.removePhone).toHaveBeenCalledWith(ACTOR);
    });

    it("explains a removal refused because there is no number", async () => {
      identity.removePhone.mockResolvedValue({ status: "rejected", reason: "no_phone" });
      expect(await removePhoneAction()).toMatchObject({
        status: "error",
        message: expect.stringContaining("no phone number"),
      });
    });

    it("sends the person through a fresh sign-in when removal needs one", async () => {
      identity.removePhone.mockResolvedValue({ status: "reauth_required" });
      expect(await removePhoneAction()).toEqual({ status: "reauth_required" });
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

  describe("changePasswordAction", () => {
    const input = { currentPassword: "Current-password-1", newPassword: "A-better-passphrase-2" };

    it("changes the password as the signed-in person and reports a plain change", async () => {
      identity.changePassword.mockResolvedValue({
        status: "ok",
        value: { changed: true, created: false },
      });
      expect(await changePasswordAction(input)).toEqual({ status: "ok", created: false });
      expect(identity.changePassword).toHaveBeenCalledWith(ACTOR, input);
    });

    it("sets a first password when no current password is sent", async () => {
      identity.changePassword.mockResolvedValue({
        status: "ok",
        value: { changed: true, created: true },
      });
      expect(
        await changePasswordAction({ currentPassword: null, newPassword: input.newPassword }),
      ).toEqual({ status: "ok", created: true });
    });

    it("repeats the form's checks without calling the issuer", async () => {
      expect(await changePasswordAction({ ...input, newPassword: "short" })).toMatchObject({
        status: "error",
        field: "next",
      });
      expect(await changePasswordAction({ ...input, currentPassword: "" })).toMatchObject({
        status: "error",
        field: "current",
      });
      expect(
        await changePasswordAction({ ...input, newPassword: input.currentPassword }),
      ).toMatchObject({ status: "error", field: "next" });
      expect(identity.changePassword).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid_password", "current"],
      ["invalid_password_policy", "next"],
      ["password_breached", "next"],
      ["same_password", "next"],
      ["rate_limited", "current"],
    ] as const)("maps the issuer's %s to the %s field", async (reason, field) => {
      identity.changePassword.mockResolvedValue({ status: "rejected", reason });
      expect(await changePasswordAction(input)).toMatchObject({ status: "error", field });
    });

    it("sends a stale sign-in, or no sign-in, through a fresh one", async () => {
      identity.changePassword.mockResolvedValue({ status: "reauth_required" });
      expect(await changePasswordAction(input)).toEqual({ status: "reauth_required" });
      loadAccountRecord.mockResolvedValue(null);
      identity.changePassword.mockClear();
      expect(await changePasswordAction(input)).toEqual({ status: "reauth_required" });
      expect(identity.changePassword).not.toHaveBeenCalled();
    });

    it("says nothing was changed when the issuer cannot be reached, and names no field", async () => {
      identity.changePassword.mockResolvedValue({ status: "unavailable" });
      expect(await changePasswordAction(input)).toMatchObject({
        status: "error",
        field: null,
        message: expect.stringContaining("Nothing was changed"),
      });
    });
  });
});
