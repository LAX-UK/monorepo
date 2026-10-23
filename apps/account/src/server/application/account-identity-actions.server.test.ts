import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = {
  rename: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
};
const loadAccountRecord = vi.fn();

vi.mock("../container", () => ({ getLaxAccountContainer: () => ({ identity }) }));
vi.mock("./load-account-record", () => ({ loadAccountRecord: () => loadAccountRecord() }));

const { renameAccountAction, signOutDeviceAction, signOutOtherDevicesAction } = await import(
  "./account-identity-actions.server"
);

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
});
