import { describe, expect, it, vi } from "vitest";
import { createAccountSignInMethodsRoutes } from "./account-sign-in-methods.routes.js";

const READ = "/lax/account-sign-in-methods";
const UNLINK = "/lax/account-sign-in-methods/unlink";
const INTENT = "/lax/account-sign-in-methods/intent";
const PASSKEY_RENAME = "/lax/account-sign-in-methods/passkeys/rename";
const PASSKEY_REMOVE = "/lax/account-sign-in-methods/passkeys/remove";
const SUBJECT = "11111111-1111-4111-8111-111111111111";

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

function setup(
  overrides: {
    client?: string | null;
    introspection?: unknown;
    writeRateLimit?: number | null;
    unlink?: unknown;
    start?: unknown;
    rename?: unknown;
    removePasskey?: unknown;
  } = {},
) {
  const methods = {
    read: vi.fn().mockResolvedValue({
      hasPassword: false,
      social: [
        {
          provider: "google",
          linkedAt: "2026-10-01T09:00:00.000Z",
          providerEmail: "ada@example.com",
          hidden: false,
        },
      ],
      passkeys: [],
      available: { google: true, apple: false, passkey: false },
    }),
    unlink: vi
      .fn()
      .mockResolvedValue(overrides.unlink ?? { ok: true, unlinked: "google", revokedSessions: 2 }),
    renamePasskey: vi.fn().mockResolvedValue(
      overrides.rename ?? {
        ok: true,
        passkey: {
          id: "pk-1",
          name: "Work laptop",
          synced: true,
          kind: "platform",
          createdAt: "2026-10-02T09:00:00.000Z",
          lastUsedAt: null,
        },
      },
    ),
    removePasskey: vi
      .fn()
      .mockResolvedValue(overrides.removePasskey ?? { ok: true, revokedSessions: 3 }),
  };
  const actions = {
    start: vi
      .fn()
      .mockResolvedValue(
        overrides.start ?? { ok: true, url: "https://auth.test/account-action?ticket=t" },
      ),
  };
  const onFailure = vi.fn();
  const app = createAccountSignInMethodsRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: {
      introspect: vi
        .fn()
        .mockResolvedValue(overrides.introspection ?? { active: true, sub: SUBJECT }),
    } as never,
    readRateLimit: async () => null,
    writeRateLimit: async () => overrides.writeRateLimit ?? null,
    methods,
    actions,
    onFailure,
  });
  const call = (path: string, body: string, auth = basic("lax-account-web")) =>
    app.request(path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  return { call, methods, actions, onFailure };
}

describe("account sign-in methods routes", () => {
  it("lists the methods for the token's own subject, uncached", async () => {
    const { call, methods } = setup();
    const response = await call(READ, "token=t");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      hasPassword: false,
      social: [
        {
          provider: "google",
          linkedAt: "2026-10-01T09:00:00.000Z",
          providerEmail: "ada@example.com",
          hidden: false,
        },
      ],
      passkeys: [],
      available: { google: true, apple: false, passkey: false },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(methods.read).toHaveBeenCalledWith(SUBJECT);
  });

  it("removes a provider for the signed-in person", async () => {
    const { call, methods } = setup();
    const response = await call(UNLINK, "token=t&sid=current&provider=google");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unlinked: "google", revokedSessions: 2 });
    expect(methods.unlink).toHaveBeenCalledWith(SUBJECT, "current", "google");
  });

  it("refuses every client except LAX Account", async () => {
    const { call, methods } = setup({ client: "lax-bid-web" });
    const response = await call(UNLINK, "token=t&sid=current&provider=google");
    expect(response.status).toBe(403);
    expect(methods.unlink).not.toHaveBeenCalled();
  });

  it("refuses an inactive token", async () => {
    const { call, methods } = setup({ introspection: { active: false } });
    const response = await call(UNLINK, "token=t&sid=current&provider=google");
    expect(response.status).toBe(401);
    expect(methods.unlink).not.toHaveBeenCalled();
  });

  it("rejects a missing session id or an unknown provider", async () => {
    const { call, methods } = setup();
    expect((await call(UNLINK, "token=t&provider=google")).status).toBe(400);
    expect((await call(UNLINK, "token=t&sid=current&provider=credential")).status).toBe(400);
    expect((await call(UNLINK, "token=t&sid=current")).status).toBe(400);
    expect(methods.unlink).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in with reauth_required", async () => {
    const { call } = setup({ unlink: { ok: false, reason: "reauth_required" } });
    const response = await call(UNLINK, "token=t&sid=current&provider=google");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "reauth_required" });
  });

  it("refuses the last method with 422 and an unlinked provider with 404", async () => {
    const last = setup({ unlink: { ok: false, kind: "last_sign_in_method" } });
    const lastResponse = await last.call(UNLINK, "token=t&sid=current&provider=google");
    expect(lastResponse.status).toBe(422);
    expect(await lastResponse.json()).toEqual({ error: "last_sign_in_method" });

    const missing = setup({ unlink: { ok: false, kind: "not_linked" } });
    const missingResponse = await missing.call(UNLINK, "token=t&sid=current&provider=apple");
    expect(missingResponse.status).toBe(404);
  });

  it("answers 429 with Retry-After when over the removal budget", async () => {
    const { call, methods } = setup({ writeRateLimit: 30 });
    const response = await call(UNLINK, "token=t&sid=current&provider=google");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(methods.unlink).not.toHaveBeenCalled();
  });

  describe("starting an add (the hand-off to the issuer's own page)", () => {
    it("gives the signed-in person a one-time address for the method they asked for", async () => {
      const { call, actions } = setup();
      const response = await call(INTENT, "token=t&sid=current&action=google");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ url: "https://auth.test/account-action?ticket=t" });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(actions.start).toHaveBeenCalledWith(SUBJECT, "current", "google");
    });

    it("takes the person from the token and the session from the caller, never from a field", async () => {
      const { call, actions } = setup();
      await call(INTENT, "token=t&sid=current&action=apple&subject=someone-else&userId=x");
      expect(actions.start).toHaveBeenCalledWith(SUBJECT, "current", "apple");
    });

    it("refuses every client except LAX Account, and an inactive token", async () => {
      const other = setup({ client: "lax-bid-web" });
      expect((await other.call(INTENT, "token=t&sid=current&action=google")).status).toBe(403);
      const inactive = setup({ introspection: { active: false } });
      expect((await inactive.call(INTENT, "token=t&sid=current&action=google")).status).toBe(401);
      expect(other.actions.start).not.toHaveBeenCalled();
      expect(inactive.actions.start).not.toHaveBeenCalled();
    });

    it("rejects a missing session id or an action that is not a way to sign in", async () => {
      const { call, actions } = setup();
      expect((await call(INTENT, "token=t&action=google")).status).toBe(400);
      expect((await call(INTENT, "token=t&sid=current&action=credential")).status).toBe(400);
      expect((await call(INTENT, "token=t&sid=current")).status).toBe(400);
      expect(actions.start).not.toHaveBeenCalled();
    });

    it("asks for a fresh sign-in with reauth_required", async () => {
      const { call } = setup({ start: { ok: false, reason: "reauth_required" } });
      const response = await call(INTENT, "token=t&sid=current&action=google");
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "reauth_required" });
    });

    it.each([
      ["not_available", 404],
      ["staff_not_allowed", 403],
      ["already_linked", 409],
    ] as const)("refuses with %s as %s", async (kind, status) => {
      const { call } = setup({ start: { ok: false, kind } });
      const response = await call(INTENT, "token=t&sid=current&action=google");
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: kind });
    });

    it("answers 429 with Retry-After when over the budget", async () => {
      const { call, actions } = setup({ writeRateLimit: 12 });
      const response = await call(INTENT, "token=t&sid=current&action=google");
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("12");
      expect(actions.start).not.toHaveBeenCalled();
    });

    it("answers 503 and reports a failure, naming nothing", async () => {
      const { call, actions, onFailure } = setup();
      actions.start.mockRejectedValue(new Error("redis down: secret"));
      const response = await call(INTENT, "token=t&sid=current&action=google");
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
      expect(onFailure).toHaveBeenCalled();
    });
  });

  it("answers 503 and reports an unexpected failure", async () => {
    const { call, methods, onFailure } = setup();
    methods.unlink.mockRejectedValue(new Error("down"));
    const response = await call(UNLINK, "token=t&sid=current&provider=google");
    expect(response.status).toBe(503);
    expect(onFailure).toHaveBeenCalled();
  });

  describe("passkeys", () => {
    it("renames a passkey for the signed-in person", async () => {
      const { call, methods } = setup();
      const response = await call(PASSKEY_RENAME, "token=t&passkeyId=pk-1&name=Work%20laptop");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ passkey: { id: "pk-1", name: "Work laptop" } });
      expect(methods.renamePasskey).toHaveBeenCalledWith(SUBJECT, "pk-1", "Work laptop");
    });

    it("answers 400 for a name that is not allowed, and 404 for a passkey that is not theirs", async () => {
      const bad = setup({ rename: { ok: false, kind: "invalid_name" } });
      expect((await bad.call(PASSKEY_RENAME, "token=t&passkeyId=pk-1&name=")).status).toBe(400);
      const missing = setup({ rename: { ok: false, kind: "not_linked" } });
      expect((await missing.call(PASSKEY_RENAME, "token=t&passkeyId=pk-9&name=x")).status).toBe(
        404,
      );
      const nothing = setup();
      expect((await nothing.call(PASSKEY_RENAME, "token=t&name=x")).status).toBe(400);
    });

    it("removes a passkey for the signed-in person, with their session", async () => {
      const { call, methods } = setup();
      const response = await call(PASSKEY_REMOVE, "token=t&sid=current&passkeyId=pk-1");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ removed: true, revokedSessions: 3 });
      expect(methods.removePasskey).toHaveBeenCalledWith(SUBJECT, "current", "pk-1");
    });

    it("answers 403 reauth_required without a recent sign-in, 422 for the last method, 404 for another person's passkey", async () => {
      const stale = setup({ removePasskey: { ok: false, reason: "reauth_required" } });
      const staleResponse = await stale.call(PASSKEY_REMOVE, "token=t&sid=current&passkeyId=pk-1");
      expect(staleResponse.status).toBe(403);
      expect(await staleResponse.json()).toEqual({ error: "reauth_required" });
      const last = setup({ removePasskey: { ok: false, kind: "last_sign_in_method" } });
      const lastResponse = await last.call(PASSKEY_REMOVE, "token=t&sid=current&passkeyId=pk-1");
      expect(lastResponse.status).toBe(422);
      expect(await lastResponse.json()).toEqual({ error: "last_sign_in_method" });
      const other = setup({ removePasskey: { ok: false, kind: "not_linked" } });
      expect((await other.call(PASSKEY_REMOVE, "token=t&sid=current&passkeyId=pk-9")).status).toBe(
        404,
      );
    });

    it("needs the session and the passkey, refuses every client but LAX Account, and is rate limited", async () => {
      const { call, methods } = setup();
      expect((await call(PASSKEY_REMOVE, "token=t&passkeyId=pk-1")).status).toBe(400);
      expect((await call(PASSKEY_REMOVE, "token=t&sid=current")).status).toBe(400);
      const other = setup({ client: "lax-bid-web" });
      expect((await other.call(PASSKEY_REMOVE, "token=t&sid=current&passkeyId=pk-1")).status).toBe(
        403,
      );
      const limited = setup({ writeRateLimit: 30 });
      expect((await limited.call(PASSKEY_RENAME, "token=t&passkeyId=pk-1&name=x")).status).toBe(
        429,
      );
      expect(methods.removePasskey).not.toHaveBeenCalled();
    });

    it("answers 503 and reports it when the issuer cannot do the change", async () => {
      const { call, methods, onFailure } = setup();
      methods.removePasskey.mockRejectedValueOnce(new Error("database down"));
      const response = await call(PASSKEY_REMOVE, "token=t&sid=current&passkeyId=pk-1");
      expect(response.status).toBe(503);
      expect(onFailure).toHaveBeenCalled();
    });
  });
});
