import { describe, expect, it, vi } from "vitest";
import {
  DURABLE_RETRY_DELAYS_MS,
  DurableSecurityEffects,
} from "../services/durable-security-effects.js";
import { InMemorySecurityEffectOutbox } from "../services/durable-security-effects.test-util.js";
import { createAuthRequestHandler } from "./create-auth-request-handler.js";

const silentLog = () => ({ warn: vi.fn(), error: vi.fn() });

function setup(
  publish = vi.fn(async () => undefined),
  opts: {
    twoFactorEnabled?: boolean;
    response?: () => Response;
    requiredByPolicy?: boolean;
    getSession?: () => Promise<unknown>;
    readTwoFactorRequirement?: () => Promise<unknown>;
  } = {},
) {
  const log = silentLog();
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
      getSession: vi.fn(
        opts.getSession ??
          (async () => ({
            user: { id: "subject-1", twoFactorEnabled: opts.twoFactorEnabled ?? false },
            session: { id: "session-1" },
          })),
      ),
      revokeOtherSessions,
    },
  };
  const sessionStampStore = {
    stampPasswordAuth: vi.fn(async () => undefined),
    stampMfaCompleted: vi.fn(async () => undefined),
    stampSocialAuth: vi.fn(async () => undefined),
  };
  const outbox = new InMemorySecurityEffectOutbox();
  const operations = { removeOtherSessions: vi.fn(async () => ["other"]) };
  const clock = { now: new Date("2026-10-23T12:00:00.000Z") };
  const durable = new DurableSecurityEffects(
    outbox,
    { operations, logout, events: { publish } } as never,
    log,
    () => clock.now,
  );
  const notices = { notify: vi.fn(async () => undefined) };
  const handler = createAuthRequestHandler({
    log,
    durable,
    notices,
    sessionStampStore,
    readTwoFactorRequirement: (opts.readTwoFactorRequirement ??
      (async () => ({
        required: opts.requiredByPolicy ?? false,
        sources: opts.requiredByPolicy ? [{ scope: "staff" as const }] : [],
      }))) as never,
    auth: auth as never,
    oidcSessions: {
      runTokenRequest: vi.fn(async (_code, action) => action()),
      captureAuthorizationSession: vi.fn(async () => undefined),
    } as never,
  });
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  return {
    auth,
    handler,
    log,
    logout,
    publish,
    revokeOtherSessions,
    sessionStampStore,
    notices,
    outbox,
    operations,
    durable,
    advance,
  };
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

  it("still ends the session and answers success when event publication fails", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("outbox unavailable"));
    const { handler, logout, outbox } = setup(publish);

    const response = await handler(
      new Request("https://auth.test/api/auth/sign-out", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(logout.revokeIdentitySessions).toHaveBeenCalledWith(["session-1"]);
    expect(outbox.rows.map((row) => row.job.kind)).toEqual(["publish_session_revoked"]);
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
      log: silentLog(),
      durable: { settle: vi.fn(async () => undefined) },
      notices: { notify: vi.fn(async () => undefined) },
      sessionStampStore: {} as never,
      readTwoFactorRequirement: vi.fn(async () => ({ required: false, sources: [] })),
      auth: auth as never,
      oidcSessions: {
        runTokenRequest: vi.fn(async (_code, action) => action()),
        captureAuthorizationSession,
      } as never,
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
      log: silentLog(),
      durable: { settle: vi.fn(async () => undefined) },
      notices: { notify: vi.fn(async () => undefined) },
      sessionStampStore: {} as never,
      readTwoFactorRequirement: vi.fn(async () => ({ required: false, sources: [] })),
      auth: auth as never,
      oidcSessions: {
        runTokenRequest: vi.fn(async (_code, action) => action()),
        captureAuthorizationSession: vi.fn(),
      } as never,
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

describe("when a security side effect fails after 2FA changed", () => {
  const enrol = () =>
    new Request("https://auth.test/api/auth/two-factor/verify-totp", { method: "POST" });

  it("returns the successful response and logs the failure with context", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("outbox unavailable"));
    const { handler, log, logout } = setup(publish, { response: rotatedSessionResponse });
    logout.revokeSubjectExceptIdentitySession.mockRejectedValue(new Error("redis down"));

    const response = await handler(enrol());

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("rotated-token");
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({
        effect: "publish_credential_changed",
        userId: "subject-1",
        errorMessage: "outbox unavailable",
        attempt: 1,
      }),
      "auth_security_effect_failed",
    );
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("rotated-token");
  });

  it("still attempts every effect when one fails", async () => {
    const { handler, logout, revokeOtherSessions } = setup(undefined, {
      response: rotatedSessionResponse,
    });
    revokeOtherSessions.mockRejectedValue(new Error("db down"));

    await handler(enrol());

    expect(logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed revocation durable and recovers it on a later drain", async () => {
    const { handler, log, logout, outbox, durable, advance } = setup(undefined, {
      response: rotatedSessionResponse,
    });
    logout.revokeSubjectExceptIdentitySession
      .mockRejectedValueOnce(new Error("redis down"))
      .mockResolvedValue(1);

    await handler(enrol());
    expect(outbox.rows.map((row) => row.job.kind)).toEqual(["revoke_tokens_except_session"]);

    advance(DURABLE_RETRY_DELAYS_MS[0]);
    await durable.drain();

    expect(logout.revokeSubjectExceptIdentitySession).toHaveBeenCalledTimes(2);
    expect(outbox.rows).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "revoke_tokens_except_session", attempt: 2 }),
      "auth_security_effect_recovered",
    );
  });

  it("retries ending other sessions without the request's cookie", async () => {
    const { handler, revokeOtherSessions, operations, outbox, durable, advance } = setup(
      undefined,
      { response: rotatedSessionResponse },
    );
    revokeOtherSessions.mockRejectedValue(new Error("db down"));

    await handler(enrol());
    advance(DURABLE_RETRY_DELAYS_MS[0]);
    await durable.drain();

    expect(operations.removeOtherSessions).toHaveBeenCalledWith("subject-1", "session-1");
    expect(outbox.rows).toHaveLength(0);
  });

  it("keeps the session when stamping the MFA claim fails", async () => {
    const { handler, log, sessionStampStore } = setup(undefined, {
      twoFactorEnabled: true,
      response: rotatedSessionResponse,
    });
    sessionStampStore.stampMfaCompleted.mockRejectedValue(new Error("db down"));

    const response = await handler(enrol());

    expect(response.status).toBe(200);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "stamp_mfa_completed" }),
      "auth_security_effect_failed",
    );
  });
});

describe("security notices", () => {
  const post = (path: string) =>
    new Request(`https://auth.test/api/auth${path}`, {
      method: "POST",
      headers: { "user-agent": "Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36" },
    });

  it.each([
    ["enrolling", "/two-factor/verify-totp", false, "two_factor_enabled"],
    ["turning off", "/two-factor/disable", true, "two_factor_disabled"],
    [
      "regenerating backup codes",
      "/two-factor/generate-backup-codes",
      true,
      "backup_codes_regenerated",
    ],
    ["changing the password", "/change-password", false, "password_changed"],
  ] as const)("emails the person after %s", async (_label, path, twoFactorEnabled, kind) => {
    const { handler, notices } = setup(undefined, {
      twoFactorEnabled,
      response: rotatedSessionResponse,
    });

    await handler(post(path));

    expect(notices.notify).toHaveBeenCalledWith({
      kind,
      userId: "subject-1",
      at: expect.any(Date),
      userAgent: "Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36",
    });
  });

  it("says nothing when the change did not happen", async () => {
    const { handler, notices } = setup(undefined, {
      response: () => Response.json({ code: "INVALID_CODE" }, { status: 401 }),
    });

    await handler(post("/two-factor/generate-backup-codes"));

    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("says nothing for step-up verification of an already enabled factor", async () => {
    const { handler, notices } = setup(undefined, { twoFactorEnabled: true });

    await handler(post("/two-factor/verify-totp"));

    expect(notices.notify).not.toHaveBeenCalled();
  });
});

describe("when a lookup fails before 2FA changes", () => {
  it("refuses with a retryable 503 instead of a 500 when the session lookup fails", async () => {
    const { auth, handler } = setup(undefined, {
      getSession: async () => {
        throw new Error("db down");
      },
    });

    const response = await handler(
      new Request("https://auth.test/api/auth/two-factor/verify-totp", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(auth.handler).not.toHaveBeenCalled();
  });

  it("does not turn 2FA off when the policy cannot be read", async () => {
    const { auth, handler } = setup(undefined, {
      twoFactorEnabled: true,
      readTwoFactorRequirement: async () => {
        throw new Error("db down");
      },
    });

    const response = await handler(
      new Request("https://auth.test/api/auth/two-factor/disable", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    expect(auth.handler).not.toHaveBeenCalled();
  });

  it("returns an authorisation error rather than a 500 when the issued code's session cannot be confirmed", async () => {
    const getSession = vi.fn().mockRejectedValue(new Error("db down"));
    const captureAuthorizationSession = vi.fn();
    const handler = createAuthRequestHandler({
      log: silentLog(),
      durable: { settle: vi.fn(async () => undefined) },
      notices: { notify: vi.fn(async () => undefined) },
      sessionStampStore: {} as never,
      readTwoFactorRequirement: vi.fn(),
      auth: {
        handler: vi.fn(async () =>
          Response.json({ redirectURI: "https://shop.example/auth/callback?code=issued-code" }),
        ),
        api: { getSession },
      } as never,
      oidcSessions: {
        runTokenRequest: vi.fn(async (_code, action) => action()),
        captureAuthorizationSession,
      } as never,
    });

    const response = await handler(
      new Request("https://auth.test/api/auth/sign-in/email", { method: "POST" }),
    );

    expect(response.status).not.toBe(500);
    expect(captureAuthorizationSession).not.toHaveBeenCalled();
  });
});
