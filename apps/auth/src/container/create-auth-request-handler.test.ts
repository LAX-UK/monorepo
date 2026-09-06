import { describe, expect, it, vi } from "vitest";
import { createAuthRequestHandler } from "./create-auth-request-handler.js";

function setup(publish = vi.fn(async () => undefined)) {
  const logout = {
    revokeClientSubject: vi.fn(async () => 1),
    revokeIdentitySessions: vi.fn(async () => 1),
    revokeSubject: vi.fn(async () => 1),
  };
  const auth = {
    handler: vi.fn(async () => Response.json({ ok: true })),
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "subject-1" },
        session: { id: "session-1" },
      })),
    },
  };
  const handler = createAuthRequestHandler({
    events: { publish },
    sessionStampStore: {} as never,
    auth: auth as never,
    oidcSessions: {
      runTokenRequest: vi.fn(async (_code, action) => action()),
      captureAuthorizationSession: vi.fn(async () => undefined),
    } as never,
    logout,
  });
  return { handler, logout, publish };
}

describe("auth request lifecycle ordering", () => {
  it("records password changes and dispatches logout", async () => {
    const { handler, logout, publish } = setup();

    await expect(
      handler(new Request("https://auth.test/api/auth/change-password", { method: "POST" })),
    ).resolves.toMatchObject({ status: 200 });

    expect(publish).toHaveBeenCalledWith({
      type: "user.credential_changed",
      userId: "subject-1",
      changeType: "update",
    });
    expect(logout.revokeSubject).toHaveBeenCalledWith("subject-1");
  });

  it("still dispatches logout when durable event publication fails", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("outbox unavailable"));
    const { handler, logout } = setup(publish);

    await expect(
      handler(new Request("https://auth.test/api/auth/sign-out", { method: "POST" })),
    ).rejects.toThrow("outbox unavailable");
    expect(logout.revokeIdentitySessions).toHaveBeenCalledWith(["session-1"]);
  });
});
