import { describe, expect, it, vi } from "vitest";
import { createAuthRequestHandler } from "./create-auth-request-handler.js";

function setup(
  publish = vi.fn(async () => undefined),
  opts: {
    twoFactorEnabled?: boolean;
    response?: () => Response;
    requiredByPolicy?: boolean;
  } = {},
) {
  const logout = {
    revokeClientSubject: vi.fn(async () => 1),
    revokeIdentitySessions: vi.fn(async () => 1),
    revokeSubject: vi.fn(async () => 1),
    revokeSubjectExceptIdentitySession: vi.fn(async () => 1),
  };
  const revokeOtherSessions = vi.fn(async (_input: { headers: Headers }) => ({ status: true }));
  const auth = {
    handler: vi.fn(async () => opts.response?.() ?? Response.json({ ok: true })),
    api: {
      getSession: vi.fn(async () => ({
        user: { id: "subject-1", twoFactorEnabled: opts.twoFactorEnabled ?? false },
        session: { id: "session-1" },
      })),
      revokeOtherSessions,
    },
  };
  const sessionStampStore = {
    stampPasswordAuth: vi.fn(async () => undefined),
    stampMfaCompleted: vi.fn(async () => undefined),
    stampSocialAuth: vi.fn(async () => undefined),
  };
  const handler = createAuthRequestHandler({
    events: { publish },
    sessionStampStore,
    readTwoFactorRequirement: vi.fn(async () => ({
      required: opts.requiredByPolicy ?? false,
      sources: opts.requiredByPolicy ? [{ scope: "staff" as const }] : [],
    })),
    auth: auth as never,
    oidcSessions: {
      runTokenRequest: vi.fn(async (_code, action) => action()),
      captureAuthorizationSession: vi.fn(async () => undefined),
    } as never,
    logout,
  });
  return { auth, handler, logout, publish, revokeOtherSessions, sessionStampStore };
}

const rotatedSessionResponse = () =>
  Response.json(
    { status: true },
    { headers: { "set-cookie": "better-auth.session_token=rotated-token; Path=/; HttpOnly" } },
  );

describe("two-factor state changes", () => {
  it.each([
    ["disable", "/api/auth/two-factor/disable", true],
    ["first TOTP verification", "/api/auth/two-factor/verify-totp", false],
  ] as const)("revokes other sessions after %s", async (_label, path, twoFactorEnabled) => {
    const { handler, logout, publish, revokeOtherSessions } = setup(undefined, {
      twoFactorEnabled,
      response: rotatedSessionResponse,
    });

    await handler(new Request(`https://auth.test${path}`, { method: "POST" }));

    expect(logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledWith(
      "subject-1",
      "session-1",
    );
    expect(logout.revokeSubject).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith({
      type: "user.credential_changed",
      userId: "subject-1",
      changeType: "update",
    });
    const headers = revokeOtherSessions.mock.calls[0]?.[0].headers;
    expect(headers?.get("cookie")).toContain("better-auth.session_token=rotated-token");
  });

  it("leaves sessions alone for step-up TOTP when 2FA is already enabled", async () => {
    const { handler, logout, revokeOtherSessions } = setup(undefined, {
      twoFactorEnabled: true,
      response: rotatedSessionResponse,
    });

    await handler(
      new Request("https://auth.test/api/auth/two-factor/verify-totp", { method: "POST" }),
    );

    expect(logout.revokeSubjectExceptIdentitySession).not.toHaveBeenCalled();
    expect(revokeOtherSessions).not.toHaveBeenCalled();
  });

  it("does not revoke when verification fails", async () => {
    const { handler, logout } = setup(undefined, {
      response: () => Response.json({ code: "INVALID_CODE" }, { status: 401 }),
    });

    await handler(
      new Request("https://auth.test/api/auth/two-factor/verify-totp", { method: "POST" }),
    );

    expect(logout.revokeSubjectExceptIdentitySession).not.toHaveBeenCalled();
  });
});

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

  it("binds authorization codes using the response session and bypasses cookie cache", async () => {
    const captureAuthorizationSession = vi.fn(async () => undefined);
    const getSession = vi.fn(async () => ({
      user: { id: "subject-2" },
      session: { id: "session-2" },
    }));
    const auth = {
      handler: vi.fn(async () =>
        Response.json(
          { redirectURI: "https://shop.example/auth/callback?code=issued-code" },
          {
            headers: {
              "set-cookie":
                "better-auth.session_token=new-token; Path=/; HttpOnly, better-auth.session_data=stale; Path=/",
            },
          },
        ),
      ),
      api: { getSession },
    };
    const handler = createAuthRequestHandler({
      events: { publish: vi.fn(async () => undefined) },
      sessionStampStore: {} as never,
      readTwoFactorRequirement: vi.fn(async () => ({ required: false, sources: [] })),
      auth: auth as never,
      oidcSessions: {
        runTokenRequest: vi.fn(async (_code, action) => action()),
        captureAuthorizationSession,
      } as never,
      logout: {
        revokeClientSubject: vi.fn(),
        revokeIdentitySessions: vi.fn(),
        revokeSubject: vi.fn(),
        revokeSubjectExceptIdentitySession: vi.fn(),
      },
    });

    await handler(
      new Request("https://auth.test/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          cookie:
            "better-auth.session_token=old-token; better-auth.session_data=deleted-session-cache",
        },
      }),
    );

    expect(getSession).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { disableCookieCache: true },
        headers: expect.any(Headers),
      }),
    );
    type GetSessionInput = { headers: Headers; query?: { disableCookieCache?: boolean } };
    const getSessionInput = (getSession.mock.calls as unknown as [GetSessionInput][])[0]?.[0];
    expect(getSessionInput).toBeDefined();
    const headers = getSessionInput?.headers;
    if (!headers) throw new Error("expected getSession headers");
    expect(headers.get("cookie")).toContain("better-auth.session_token=new-token");
    expect(headers.get("cookie")).not.toContain("session_data");
    expect(captureAuthorizationSession).toHaveBeenCalledWith(expect.any(Response), "session-2");
  });

  it("expires session_data when sign-out clears session_token", async () => {
    const auth = {
      handler: vi.fn(
        async () =>
          new Response(null, {
            status: 200,
            headers: {
              "set-cookie": "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly",
            },
          }),
      ),
      api: {
        getSession: vi.fn(async () => ({
          user: { id: "subject-1" },
          session: { id: "session-1" },
        })),
      },
    };
    const handler = createAuthRequestHandler({
      events: { publish: vi.fn(async () => undefined) },
      sessionStampStore: {} as never,
      readTwoFactorRequirement: vi.fn(async () => ({ required: false, sources: [] })),
      auth: auth as never,
      oidcSessions: {
        runTokenRequest: vi.fn(async (_code, action) => action()),
        captureAuthorizationSession: vi.fn(),
      } as never,
      logout: {
        revokeClientSubject: vi.fn(),
        revokeIdentitySessions: vi.fn(async () => 1),
        revokeSubject: vi.fn(),
        revokeSubjectExceptIdentitySession: vi.fn(),
      },
    });

    const response = await handler(
      new Request("https://auth.test/api/auth/sign-out", { method: "POST" }),
    );
    const cookies = response.headers.getSetCookie?.() ?? [];
    expect(cookies.some((c) => c.startsWith("better-auth.session_data=; Max-Age=0"))).toBe(true);
  });
});

describe("two-factor policy", () => {
  it("refuses to turn off two-step verification while a policy requires it", async () => {
    const { auth, handler, logout } = setup(undefined, {
      twoFactorEnabled: true,
      requiredByPolicy: true,
    });

    const response = await handler(
      new Request("https://auth.test/api/auth/two-factor/disable", { method: "POST" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "TWO_FACTOR_REQUIRED_BY_POLICY",
    });
    expect(auth.handler).not.toHaveBeenCalled();
    expect(logout.revokeSubjectExceptIdentitySession).not.toHaveBeenCalled();
  });

  it("stamps social sign-in on the session created by an OAuth callback", async () => {
    const { handler, sessionStampStore } = setup(undefined, {
      response: () =>
        new Response(null, {
          status: 302,
          headers: {
            location: "https://auth.test/api/auth/oauth2/authorize?client_id=shop",
            "set-cookie": "better-auth.session_token=social-token; Path=/; HttpOnly",
          },
        }),
    });

    await handler(new Request("https://auth.test/api/auth/callback/google?code=provider-code"));

    expect(sessionStampStore.stampSocialAuth).toHaveBeenCalledWith(
      "social-token",
      expect.any(Date),
    );
  });

  it("does not stamp social sign-in for password sign-in", async () => {
    const { handler, sessionStampStore } = setup(undefined, { response: rotatedSessionResponse });

    await handler(new Request("https://auth.test/api/auth/sign-in/email", { method: "POST" }));

    expect(sessionStampStore.stampSocialAuth).not.toHaveBeenCalled();
  });
});
