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

  it("uses fresh session cookies when correlating authorization codes", async () => {
    const captureAuthorizationSession = vi.fn(async () => undefined);
    const auth = {
      handler: vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: {
              Location: "https://shop.test/callback?code=issued-code&state=s",
              "set-cookie": "better-auth.session_token=fresh-token; Path=/; HttpOnly; SameSite=Lax",
            },
          }),
      ),
      api: {
        getSession: vi.fn(async (input: { headers: Headers }) => {
          const cookie = input.headers.get("cookie") ?? "";
          if (cookie.includes("better-auth.session_token=fresh-token")) {
            return { session: { id: "identity-session-fresh" } };
          }
          return { session: null };
        }),
      },
    };
    const handler = createAuthRequestHandler({
      events: { publish: vi.fn(async () => undefined) },
      sessionStampStore: {} as never,
      auth: auth as never,
      oidcSessions: {
        runTokenRequest: vi.fn(async (_code, action) => action()),
        captureAuthorizationSession,
      } as never,
      logout: {
        revokeClientSubject: vi.fn(),
        revokeIdentitySessions: vi.fn(),
        revokeSubject: vi.fn(),
      },
    });

    const response = await handler(
      new Request("https://auth.test/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          cookie: "better-auth.session_token=stale-token; __Secure-better-auth.session_data=x",
        },
      }),
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(auth.api.getSession).toHaveBeenCalled();
    const lookupHeaders = auth.api.getSession.mock.calls[0]?.[0].headers as Headers;
    const lookupCookie = lookupHeaders.get("cookie") ?? "";
    expect(lookupCookie).toContain("better-auth.session_token=fresh-token");
    expect(lookupCookie).not.toContain("stale-token");
    expect(captureAuthorizationSession).toHaveBeenCalledWith(
      expect.any(Response),
      "identity-session-fresh",
    );
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
