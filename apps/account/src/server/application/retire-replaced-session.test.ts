import { describe, expect, it, vi } from "vitest";
import type { StaffSessionRecord } from "../ports/session-store";
import { retireReplacedSession } from "./retire-replaced-session";

function record(overrides: Partial<StaffSessionRecord>): StaffSessionRecord {
  return {
    subject: "subject-1",
    sid: "sid",
    idToken: "id",
    accessToken: "access",
    refreshToken: "refresh",
    accessTokenExpiresAtMs: 0,
    authTime: 0,
    acr: "",
    ...overrides,
  };
}

function setup(stored: Record<string, StaffSessionRecord>) {
  const sessions = {
    get: vi.fn(async (id: string) => stored[id] ?? null),
    delete: vi.fn(async () => undefined),
  };
  const identity = { revokeSession: vi.fn().mockResolvedValue({ status: "ok", value: 1 }) };
  const run = (replacedSessionId: string | undefined) =>
    retireReplacedSession({
      replacedSessionId,
      newSessionId: "new",
      sessions: sessions as never,
      identity,
    });
  return { sessions, identity, run };
}

const OLD = record({ sid: "old-sid", accessToken: "old-access" });
const NEW = record({ sid: "new-sid", accessToken: "new-access" });

describe("retireReplacedSession", () => {
  it("ends the old Account session and the old issuer session, proving it with the new sign-in", async () => {
    const { sessions, identity, run } = setup({ old: OLD, new: NEW });
    await run("old");
    expect(sessions.delete).toHaveBeenCalledWith("old");
    expect(identity.revokeSession).toHaveBeenCalledWith(
      { accessToken: "new-access", sid: "new-sid" },
      "old-sid",
    );
  });

  it("does nothing when there was no earlier session", async () => {
    const { sessions, identity, run } = setup({ new: NEW });
    await run(undefined);
    expect(sessions.delete).not.toHaveBeenCalled();
    expect(identity.revokeSession).not.toHaveBeenCalled();
  });

  it("never touches the issuer session of a different person who signed in on the same browser", async () => {
    const { sessions, identity, run } = setup({
      old: record({ subject: "someone-else", sid: "their-sid" }),
      new: NEW,
    });
    await run("old");
    expect(sessions.delete).toHaveBeenCalledWith("old");
    expect(identity.revokeSession).not.toHaveBeenCalled();
  });

  it("leaves the issuer session alone when it is the one just created", async () => {
    const { identity, run } = setup({ old: record({ sid: "new-sid" }), new: NEW });
    await run("old");
    expect(identity.revokeSession).not.toHaveBeenCalled();
  });

  it("swallows a failure, because the person is already signed in again", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { identity, run } = setup({ old: OLD, new: NEW });
    identity.revokeSession.mockRejectedValue(new Error("down"));
    await expect(run("old")).resolves.toBeUndefined();
  });
});
