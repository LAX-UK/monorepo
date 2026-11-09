import { describe, expect, it, vi } from "vitest";
import { createAuthRequestHandler } from "./create-auth-request-handler.js";

const SUBJECT = "subject-1";
const SESSION = "session-1";

type Options = {
  /** Whether the environment offers passkeys at all. */
  offered?: boolean;
  /** Whether the session holds the hand-off's permission. */
  granted?: boolean;
  session?: unknown;
  getSession?: () => Promise<unknown>;
  response?: () => Response;
};

function setup(options: Options = {}) {
  const log = { warn: vi.fn(), error: vi.fn() };
  const auth = {
    handler: vi.fn(async () => options.response?.() ?? Response.json({ ok: true })),
    api: {
      getSession: vi.fn(
        options.getSession ??
          (async () =>
            options.session === undefined
              ? { user: { id: SUBJECT }, session: { id: SESSION } }
              : options.session),
      ),
    },
  };
  const sessionStampStore = {
    stampPasswordAuth: vi.fn(async () => undefined),
    stampMfaCompleted: vi.fn(async () => undefined),
    stampSocialAuth: vi.fn(async () => undefined),
    stampPasskeyAuth: vi.fn(async () => undefined),
  };
  const grants = {
    holds: vi.fn(async () => options.granted ?? true),
    spend: vi.fn(async () => true),
  };
  const onRegistered = vi.fn(async () => undefined);
  const handler = createAuthRequestHandler({
    log,
    durable: { settle: vi.fn(async () => undefined) } as never,
    notices: { notify: vi.fn(async () => undefined) },
    sessionStampStore,
    readTwoFactorRequirement: (async () => ({ required: false, sources: [] })) as never,
    auth: auth as never,
    oidcSessions: {
      runTokenRequest: vi.fn(async (_code: unknown, action: () => Promise<Response>) => action()),
      captureAuthorizationSession: vi.fn(async () => undefined),
    } as never,
    ...(options.offered === false ? {} : { passkeys: { grants, onRegistered } }),
  });
  return { handler, auth, grants, onRegistered, sessionStampStore, log };
}

const url = (path: string) => `https://auth.test/api/auth/passkey/${path}`;
const verifyRegistration = (body: unknown, userAgent = "Mozilla/5.0 Chrome/130") =>
  new Request(url("verify-registration"), {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": userAgent },
    body: JSON.stringify(body),
  });
const created = () => Response.json({ id: "pk-1", name: "iCloud Keychain" });

describe("making a passkey needs the permission the hand-off gives", () => {
  it.each(["generate-register-options", "verify-registration"])(
    "refuses %s when the session holds no permission, and the plugin never runs",
    async (path) => {
      const { handler, auth } = setup({ granted: false });
      const response = await handler(
        new Request(url(path), {
          method: path.startsWith("verify") ? "POST" : "GET",
          body: path.startsWith("verify") ? "{}" : null,
        }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "passkey_enrolment_not_allowed" });
      expect(auth.handler).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/api/auth/passkey/verify-registration/",
    "/api/auth//passkey/verify-registration",
    "/api/auth/Passkey/Verify-Registration",
    "/api/auth/passkey/generate-register-options//",
    "/api/auth/passkey/verify%2Dregistration",
  ])("is not walked around by writing the path differently: %s", async (path) => {
    const { handler, auth } = setup({ granted: false });
    const response = await handler(
      new Request(`https://auth.test${path}`, { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(403);
    expect(auth.handler).not.toHaveBeenCalled();
  });

  it("refuses a browser with no session, without asking about permission", async () => {
    const { handler, auth, grants } = setup({ session: null });
    const response = await handler(new Request(url("generate-register-options")));
    expect(response.status).toBe(401);
    expect(grants.holds).not.toHaveBeenCalled();
    expect(auth.handler).not.toHaveBeenCalled();
  });

  it("asks about the person's own session and subject, nobody else's", async () => {
    const { handler, grants } = setup();
    await handler(new Request(url("generate-register-options")));
    expect(grants.holds).toHaveBeenCalledWith(SESSION, SUBJECT);
  });

  it("fails closed, answering 503, when the session or permission cannot be read", async () => {
    const { handler, auth, log } = setup({
      getSession: async () => {
        throw new Error("redis down");
      },
    });
    const response = await handler(new Request(url("generate-register-options")));
    expect(response.status).toBe(503);
    expect(auth.handler).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/api/auth/passkey/generate-register-options" }),
      "auth_passkey_gate_failed",
    );
  });

  it("offers nothing where passkeys are not switched on", async () => {
    const { handler, auth } = setup({ offered: false });
    const response = await handler(new Request(url("generate-register-options")));
    expect(response.status).toBe(404);
    expect(auth.handler).not.toHaveBeenCalled();
  });

  it("lets the challenge be asked for without using the permission up", async () => {
    const { handler, auth, grants } = setup();
    const response = await handler(new Request(url("generate-register-options")));
    expect(response.status).toBe(200);
    expect(auth.handler).toHaveBeenCalledOnce();
    expect(grants.spend).not.toHaveBeenCalled();
  });
});

describe("the name given to a passkey", () => {
  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["over 40 characters", "x".repeat(41)],
    ["not text", 42],
  ])("refuses a name that is %s, and the plugin never runs", async (_label, name) => {
    const { handler, auth } = setup();
    const response = await handler(verifyRegistration({ response: {}, name }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "passkey_name_invalid" });
    expect(auth.handler).not.toHaveBeenCalled();
  });

  it("accepts a name of 40 characters, or none at all (the issuer suggests one)", async () => {
    const forty = setup({ response: created });
    expect(
      (await forty.handler(verifyRegistration({ response: {}, name: "x".repeat(40) }))).status,
    ).toBe(200);
    const none = setup({ response: created });
    expect((await none.handler(verifyRegistration({ response: {} }))).status).toBe(200);
  });
});

describe("after a passkey is made", () => {
  it("uses the permission up, and records the passkey with the name it was stored under and the browser", async () => {
    const { handler, grants, onRegistered } = setup({ response: created });
    const response = await handler(verifyRegistration({ response: {}, name: "Work laptop" }));
    expect(response.status).toBe(200);
    expect(grants.spend).toHaveBeenCalledWith(SESSION, SUBJECT);
    expect(onRegistered).toHaveBeenCalledWith({
      userId: SUBJECT,
      name: "iCloud Keychain",
      userAgent: "Mozilla/5.0 Chrome/130",
    });
    // The caller still gets the plugin's own answer, unread.
    expect(await response.json()).toEqual({ id: "pk-1", name: "iCloud Keychain" });
  });

  it("does nothing when the plugin refused (the limit, a device that did not check the person)", async () => {
    const refused = () => Response.json({ code: "passkey_limit" }, { status: 422 });
    const { handler, grants, onRegistered } = setup({ response: refused });
    const response = await handler(verifyRegistration({ response: {} }));
    expect(response.status).toBe(422);
    expect(grants.spend).not.toHaveBeenCalled();
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("returns the success and logs, rather than fail, when the audit or email step fails", async () => {
    const { handler, onRegistered, log } = setup({ response: created });
    onRegistered.mockRejectedValue(new Error("outbox unavailable"));
    const response = await handler(verifyRegistration({ response: {} }));
    expect(response.status).toBe(200);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "passkey_registered" }),
      "auth_security_effect_failed",
    );
  });
});

describe("signing in with a passkey", () => {
  const signedIn = () =>
    Response.json(
      { session: {}, user: {} },
      { headers: { "set-cookie": "better-auth.session_token=passkey-token; Path=/; HttpOnly" } },
    );
  const verify = () =>
    new Request(url("verify-authentication"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response: { id: "credential" } }),
    });

  it("stamps the new session as a passkey sign-in, which counts as two-step", async () => {
    const { handler, sessionStampStore } = setup({ response: signedIn });
    await handler(verify());
    expect(sessionStampStore.stampPasskeyAuth).toHaveBeenCalledWith(
      "passkey-token",
      expect.any(Date),
    );
    expect(sessionStampStore.stampMfaCompleted).not.toHaveBeenCalled();
    expect(sessionStampStore.stampPasswordAuth).not.toHaveBeenCalled();
  });

  it("stamps nothing when the passkey was refused", async () => {
    const { handler, sessionStampStore } = setup({
      response: () =>
        Response.json({ code: "passkey_user_verification_required" }, { status: 403 }),
    });
    const response = await handler(verify());
    expect(response.status).toBe(403);
    expect(sessionStampStore.stampPasskeyAuth).not.toHaveBeenCalled();
  });

  it("needs no session and no permission: it is how a person gets a session", async () => {
    const { handler, grants, auth } = setup({ session: null, response: signedIn });
    await handler(verify());
    expect(auth.handler).toHaveBeenCalledOnce();
    expect(grants.holds).not.toHaveBeenCalled();
  });

  it("still returns the sign-in, and logs, when the stamp cannot be written", async () => {
    const { handler, sessionStampStore, log } = setup({ response: signedIn });
    sessionStampStore.stampPasskeyAuth.mockRejectedValue(new Error("db down"));
    const response = await handler(verify());
    expect(response.status).toBe(200);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "stamp_passkey_auth" }),
      "auth_security_effect_failed",
    );
  });
});
