import { describe, expect, it, vi } from "vitest";
import { createAccountIdentityRoutes } from "./account-identity.routes.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-23T12:00:00.000Z");

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

function setup(
  overrides: {
    client?: string | null;
    introspection?: unknown;
    writeRateLimit?: number | null;
  } = {},
) {
  const introspect = vi
    .fn()
    .mockResolvedValue(overrides.introspection ?? { active: true, sub: SUBJECT });
  const identity = {
    readProfile: vi.fn().mockResolvedValue({ name: "Ada Lovelace" }),
    rename: vi.fn().mockResolvedValue({ ok: true, name: "Ada King" }),
    listSessions: vi.fn().mockResolvedValue({
      ok: true,
      sessions: [
        {
          id: "current",
          userAgent: "Mozilla/5.0 Chrome/130",
          createdAt: NOW,
          lastActiveAt: NOW,
          isCurrent: true,
          ipAddress: "203.0.113.9",
          token: "secret-session-token",
        },
      ],
    }),
    revokeSession: vi.fn().mockResolvedValue({ ok: true, revoked: 1 }),
    revokeOtherSessions: vi.fn().mockResolvedValue({ ok: true, revoked: 3 }),
  };
  const onFailure = vi.fn();
  const app = createAccountIdentityRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    identity: identity as never,
    readRateLimit: async () => null,
    writeRateLimit: async () => overrides.writeRateLimit ?? null,
    onFailure,
  });
  const call = (path: string, body: string, auth = basic("lax-account-web")) =>
    app.request(path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  return { call, identity, introspect, onFailure };
}

const WRITES: [string, string][] = [
  ["/lax/account-profile/update", "token=t&sid=current&name=Ada%20King"],
  ["/lax/account-sessions/revoke", "token=t&sid=current&session_id=other"],
  ["/lax/account-sessions/revoke-others", "token=t&sid=current"],
];
const ALL: [string, string][] = [
  ["/lax/account-profile", "token=t"],
  ["/lax/account-sessions", "token=t&sid=current"],
  ...WRITES,
];

describe("account identity routes", () => {
  it.each(ALL)("%s refuses every client except LAX Account", async (path, body) => {
    const { call, introspect } = setup({ client: "lax-bid-web" });
    const response = await call(path, body, basic("lax-bid-web"));
    expect(response.status).toBe(403);
    expect(introspect).not.toHaveBeenCalled();
  });

  it.each(ALL)("%s refuses bad client credentials", async (path, body) => {
    const { call, introspect } = setup({ client: null });
    expect((await call(path, body)).status).toBe(401);
    expect(introspect).not.toHaveBeenCalled();
  });

  it.each(ALL)("%s rejects an inactive token", async (path, body) => {
    const { call, identity } = setup({ introspection: { active: false } });
    const response = await call(path, body);
    expect(response.status).toBe(401);
    expect(Object.values(identity).every((fn) => fn.mock.calls.length === 0)).toBe(true);
  });

  it.each(ALL)("%s answers 429 when the subject is over its budget", async (path, body) => {
    const { call } = setup({ writeRateLimit: 9 });
    const response = await call(path, body);
    // Reads use their own budget, so only the changing routes see the write limit.
    expect(response.status).toBe(WRITES.some(([p]) => p === path) ? 429 : 200);
  });

  it("acts only for the subject that owns the access token, whatever the body names", async () => {
    const { call, identity } = setup();
    await call(
      "/lax/account-sessions/revoke-others",
      `token=t&sid=current&sub=${OTHER_SUBJECT}&userId=${OTHER_SUBJECT}`,
    );
    expect(identity.revokeOtherSessions).toHaveBeenCalledWith(SUBJECT, "current");
  });

  it("reads the profile", async () => {
    const { call } = setup();
    const response = await call("/lax/account-profile", "token=t");
    expect(await response.json()).toEqual({ name: "Ada Lovelace" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("lists sessions with only the documented fields", async () => {
    const { call } = setup();
    const response = await call("/lax/account-sessions", "token=t&sid=current");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      sessions: [
        {
          id: "current",
          userAgent: "Mozilla/5.0 Chrome/130",
          createdAt: NOW.toISOString(),
          lastActiveAt: NOW.toISOString(),
          isCurrent: true,
        },
      ],
    });
    expect(text).not.toContain("203.0.113.9");
    expect(text).not.toContain("secret-session-token");
  });

  it("renames, trimming the name", async () => {
    const { call, identity } = setup();
    const response = await call(
      "/lax/account-profile/update",
      "token=t&sid=current&name=%20Ada%20King%20",
    );
    expect(response.status).toBe(200);
    expect(identity.rename).toHaveBeenCalledWith(SUBJECT, "current", "Ada King");
  });

  it.each([
    ["an empty name", "token=t&sid=current&name=%20%20"],
    ["a missing name", "token=t&sid=current"],
    ["a name that is too long", `token=t&sid=current&name=${"a".repeat(201)}`],
    ["a missing sid", "token=t&name=Ada"],
  ])("rejects %s without changing anything", async (_label, body) => {
    const { call, identity } = setup();
    const response = await call("/lax/account-profile/update", body);
    expect(response.status).toBe(400);
    expect(identity.rename).not.toHaveBeenCalled();
  });

  it.each([
    ["/lax/account-profile/update", "rename", "token=t&sid=current&name=Ada"],
    ["/lax/account-sessions", "listSessions", "token=t&sid=current"],
    ["/lax/account-sessions/revoke", "revokeSession", "token=t&sid=current&session_id=other"],
    ["/lax/account-sessions/revoke-others", "revokeOtherSessions", "token=t&sid=current"],
  ] as const)(
    "%s answers 403 reauth_required when step-up is needed",
    async (path, method, body) => {
      const { call, identity } = setup();
      identity[method].mockResolvedValue({ ok: false, reason: "reauth_required" });
      const response = await call(path, body);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "reauth_required" });
    },
  );

  it("answers 400 when asked to sign out the current device", async () => {
    const { call, identity } = setup();
    identity.revokeSession.mockResolvedValue({ ok: false, reason: "cannot_revoke_current" });
    const response = await call(
      "/lax/account-sessions/revoke",
      "token=t&sid=current&session_id=current",
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "cannot_revoke_current" });
  });

  it("reports how many other sessions were ended", async () => {
    const { call } = setup();
    const response = await call("/lax/account-sessions/revoke-others", "token=t&sid=current");
    expect(await response.json()).toEqual({ revoked: 3 });
  });

  it("answers 503 without leaking the cause when the work fails", async () => {
    const { call, identity, onFailure } = setup();
    identity.revokeOtherSessions.mockRejectedValue(new Error("password for app_secret rejected"));
    const response = await call("/lax/account-sessions/revoke-others", "token=t&sid=current");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("app_secret");
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("requires a form body with exactly one token", async () => {
    const { call } = setup();
    expect((await call("/lax/account-sessions", "sid=current")).status).toBe(400);
    expect((await call("/lax/account-sessions", "token=a&token=b&sid=current")).status).toBe(400);
  });
});
