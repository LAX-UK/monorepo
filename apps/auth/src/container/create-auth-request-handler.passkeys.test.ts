import { describe, expect, it, vi } from "vitest";
import { createAuthRequestHandler } from "./create-auth-request-handler.js";
import { counterOfAssertion } from "./passkey-request-policy.js";

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
  /** What the issuer already knows of the passkey being used, for the counter check. */
  stored?: { id: string; userId: string; counter: number } | null;
};

function setup(options: Options = {}) {
  const log = { warn: vi.fn(), error: vi.fn() };
  const auth = {
    handler: vi.fn(
      async (_request: Request) => options.response?.() ?? Response.json({ ok: true }),
    ),
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
    spend: vi.fn(async () => options.granted ?? true),
    grant: vi.fn(async () => undefined),
  };
  const onRegistered = vi.fn(async () => undefined);
  const counters = {
    findByCredentialId: vi.fn(async () => (options.stored === undefined ? null : options.stored)),
  };
  const handler = createAuthRequestHandler({
    log,
    durable: { settle: vi.fn(async () => undefined) } as never,
    notices: { notify: vi.fn(async () => undefined) },
    sessionStampStore,
    deviceSessions: async ({ response }) => response,
    readTwoFactorRequirement: (async () => ({ required: false, sources: [] })) as never,
    auth: auth as never,
    oidcSessions: {
      runTokenRequest: vi.fn(async (_code: unknown, action: () => Promise<Response>) => action()),
      captureAuthorizationSession: vi.fn(async () => undefined),
    } as never,
    ...(options.offered === false ? {} : { passkeys: { grants, onRegistered, counters } }),
  });
  return { handler, auth, grants, onRegistered, counters, sessionStampStore, log };
}

const url = (path: string) => `https://auth.test/api/auth/passkey/${path}`;
const verifyRegistration = (body: unknown, userAgent = "Mozilla/5.0 Chrome/130") =>
  new Request(url("verify-registration"), {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": userAgent },
    body: JSON.stringify(body),
  });
/** What the plugin answers with: the whole record, public key included. */
const created = () =>
  Response.json({
    id: "pk-1",
    name: "iCloud Keychain",
    publicKey: "SECRET-PUBLIC-KEY",
    credentialID: "SECRET-CREDENTIAL-ID",
    userId: SUBJECT,
    counter: 0,
    deviceType: "multiDevice",
    backedUp: true,
    transports: "internal",
    createdAt: "2026-11-10T09:00:00.000Z",
    aaguid: "00000000-0000-0000-0000-000000000000",
  });

describe("making a passkey needs the permission the hand-off gives", () => {
  it.each(["generate-register-options", "verify-registration"])(
    "refuses %s when the session holds no permission, and the plugin never runs",
    async (path) => {
      const { handler, auth } = setup({ granted: false });
      const post = path.startsWith("verify");
      const response = await handler(
        new Request(url(path), { method: post ? "POST" : "GET", body: post ? "{}" : null }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "passkey_enrolment_not_allowed" });
      expect(auth.handler).not.toHaveBeenCalled();
    },
  );

  it("refuses a browser with no session, without asking about permission", async () => {
    const { handler, auth, grants } = setup({ session: null });
    const response = await handler(new Request(url("generate-register-options")));
    expect(response.status).toBe(401);
    expect(grants.holds).not.toHaveBeenCalled();
    expect(auth.handler).not.toHaveBeenCalled();
  });

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

  it("drops the name from the challenge request, so the device always shows the account's email", async () => {
    const { handler, auth } = setup();
    await handler(new Request(url("generate-register-options?name=Bank%20Security&context=x")));
    const forwarded = auth.handler.mock.calls[0]?.[0] as Request;
    const query = new URL(forwarded.url).searchParams;
    expect(query.has("name")).toBe(false);
    expect(query.get("context")).toBe("x");
  });
});

describe("the permission is for one passkey", () => {
  it("is used up before the plugin runs, so two answers from one step-up cannot both pass", async () => {
    const { handler, auth, grants } = setup({ response: created });
    // The first answer takes it; the second finds it gone.
    grants.spend.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await handler(verifyRegistration({ response: {} }))).status).toBe(200);
    expect((await handler(verifyRegistration({ response: {} }))).status).toBe(403);
    expect(auth.handler).toHaveBeenCalledOnce();
    expect(grants.spend).toHaveBeenCalledWith(SESSION, SUBJECT);
  });

  it("gives the permission back when the plugin refused, so the person can try again", async () => {
    const refused = () =>
      Response.json({ code: "passkey_user_verification_required" }, { status: 403 });
    const { handler, grants, onRegistered } = setup({ response: refused });
    const response = await handler(verifyRegistration({ response: {} }));
    expect(response.status).toBe(403);
    expect(grants.grant).toHaveBeenCalledWith(SESSION, SUBJECT);
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("does not give it back after a passkey was made", async () => {
    const { handler, grants } = setup({ response: created });
    await handler(verifyRegistration({ response: {} }));
    expect(grants.grant).not.toHaveBeenCalled();
  });

  it("refuses without using anything up when the name is not allowed", async () => {
    const { handler, grants, auth } = setup();
    const response = await handler(verifyRegistration({ response: {}, name: "   " }));
    expect(response.status).toBe(400);
    expect(grants.spend).not.toHaveBeenCalled();
    expect(auth.handler).not.toHaveBeenCalled();
  });
});

describe("the name given to a passkey", () => {
  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["over 40 characters", "x".repeat(41)],
    ["not text", 42],
    ["a newline", "Line one\nLine two"],
    ["a tab", "Work\tlaptop"],
    ["a zero-width space", "Work​laptop"],
    ["a right-to-left override", "Work ‮knab"],
    ["a line separator", "Work laptop"],
  ])("refuses a name with %s, and the plugin never runs", async (_label, name) => {
    const { handler, auth } = setup();
    const response = await handler(verifyRegistration({ response: {}, name }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "passkey_name_invalid" });
    expect(auth.handler).not.toHaveBeenCalled();
  });

  it("accepts a name of 40 characters, accented or non-Latin letters, or none at all", async () => {
    for (const name of ["x".repeat(40), "Portable de José", "我的笔记本电脑", undefined]) {
      const { handler } = setup({ response: created });
      expect(
        (await handler(verifyRegistration({ response: {}, ...(name ? { name } : {}) }))).status,
      ).toBe(200);
    }
  });
});

describe("after a passkey is made", () => {
  it("emails the person, naming the passkey and the browser", async () => {
    const { handler, onRegistered } = setup({ response: created });
    await handler(verifyRegistration({ response: {}, name: "Work laptop" }));
    expect(onRegistered).toHaveBeenCalledWith({
      userId: SUBJECT,
      name: "iCloud Keychain",
      userAgent: "Mozilla/5.0 Chrome/130",
    });
  });

  it("answers with what the page shows, never the public key or the credential id", async () => {
    const { handler } = setup({ response: created });
    const response = await handler(verifyRegistration({ response: {} }));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("SECRET-PUBLIC-KEY");
    expect(text).not.toContain("SECRET-CREDENTIAL-ID");
    expect(JSON.parse(text)).toEqual({
      passkey: {
        id: "pk-1",
        name: "iCloud Keychain",
        synced: true,
        kind: "platform",
        createdAt: "2026-11-10T09:00:00.000Z",
        lastUsedAt: null,
      },
    });
  });

  it("does nothing more when the plugin refused (the limit, a device that did not check the person)", async () => {
    const refused = () => Response.json({ code: "passkey_limit" }, { status: 422 });
    const { handler, onRegistered } = setup({ response: refused });
    const response = await handler(verifyRegistration({ response: {} }));
    expect(response.status).toBe(422);
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("returns the success and logs, rather than fail, when the email step fails", async () => {
    const { handler, onRegistered, log } = setup({ response: created });
    onRegistered.mockRejectedValue(new Error("outbox unavailable"));
    const response = await handler(verifyRegistration({ response: {} }));
    expect(response.status).toBe(200);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ effect: "passkey_registered" }),
      "auth_security_effect_failed",
    );
  });

  it("still emails when giving a permission back is the only thing that failed (the steps are independent)", async () => {
    const { handler, onRegistered, grants } = setup({ response: created });
    grants.grant.mockRejectedValue(new Error("redis down"));
    await handler(verifyRegistration({ response: {} }));
    expect(onRegistered).toHaveBeenCalledOnce();
  });
});

describe("signing in with a passkey", () => {
  const signedIn = () =>
    Response.json(
      { session: {}, user: {} },
      { headers: { "set-cookie": "better-auth.session_token=passkey-token; Path=/; HttpOnly" } },
    );
  /** An assertion with a signature counter in its authenticator data, as a device sends it. */
  const verify = (counter = 1) => {
    const data = Buffer.alloc(37);
    data.writeUInt32BE(counter, 33);
    return new Request(url("verify-authentication"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        response: { id: "credential", response: { authenticatorData: data.toString("base64url") } },
      }),
    });
  };

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
    expect(grants.spend).not.toHaveBeenCalled();
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

describe("a signature counter that goes backwards", () => {
  const assertion = (counter: number) => {
    const data = Buffer.alloc(37);
    data.writeUInt32BE(counter, 33);
    return new Request(url("verify-authentication"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        response: { id: "credential", response: { authenticatorData: data.toString("base64url") } },
      }),
    });
  };
  const refused = () => Response.json({ code: "AUTHENTICATION_FAILED" }, { status: 400 });

  it("is reported with its own warning, naming the person and the passkey but no key", async () => {
    const { handler, log } = setup({
      response: refused,
      stored: { id: "pk-1", userId: SUBJECT, counter: 5 },
    });
    await handler(assertion(3));
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: SUBJECT,
        passkeyId: "pk-1",
        storedCounter: 5,
        receivedCounter: 3,
      }),
      "passkey_counter_regression",
    );
  });

  it("is reported when it stands still too, because a counter that counts must go up", async () => {
    const { handler, log } = setup({ stored: { id: "pk-1", userId: SUBJECT, counter: 5 } });
    await handler(assertion(5));
    expect(log.warn).toHaveBeenCalledWith(expect.anything(), "passkey_counter_regression");
  });

  it("is not reported for a counter that goes up, or for a synced passkey that always says zero", async () => {
    const up = setup({ stored: { id: "pk-1", userId: SUBJECT, counter: 5 } });
    await up.handler(assertion(6));
    expect(up.log.warn).not.toHaveBeenCalled();
    const synced = setup({ stored: { id: "pk-2", userId: SUBJECT, counter: 0 } });
    await synced.handler(assertion(0));
    expect(synced.log.warn).not.toHaveBeenCalled();
  });

  it("never stops the request itself: the plugin does the refusing", async () => {
    const { handler, auth } = setup({
      response: refused,
      stored: { id: "pk-1", userId: SUBJECT, counter: 5 },
    });
    const response = await handler(assertion(1));
    expect(auth.handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(400);
  });
});

describe("counterOfAssertion", () => {
  it("reads the counter from the four bytes after the flags", () => {
    const data = Buffer.alloc(37);
    data.writeUInt32BE(70_000, 33);
    expect(
      counterOfAssertion({
        response: { id: "c", response: { authenticatorData: data.toString("base64url") } },
      }),
    ).toEqual({ credentialId: "c", counter: 70_000 });
  });

  it("reads nothing from a body that is not an assertion", () => {
    expect(counterOfAssertion(null)).toBeNull();
    expect(counterOfAssertion({ response: { id: "c" } })).toBeNull();
    expect(
      counterOfAssertion({ response: { id: "c", response: { authenticatorData: "AAAA" } } }),
    ).toBeNull();
  });
});
