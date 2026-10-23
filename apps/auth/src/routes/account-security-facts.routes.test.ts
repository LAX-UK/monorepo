import { describe, expect, it, vi } from "vitest";
import { createAccountSecurityFactsRoutes } from "./account-security-facts.routes.js";

const ACCOUNT_SUBJECT = "11111111-1111-4111-8111-111111111111";
const FACTS = { twoFactorEnabled: true, backupCodesRemaining: 2 };

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

function setup(overrides: {
  client?: string | null;
  introspection?: unknown;
  rateLimit?: number | null;
  read?: () => Promise<unknown>;
}) {
  const introspect = vi
    .fn()
    .mockResolvedValue(overrides.introspection ?? { active: true, sub: ACCOUNT_SUBJECT });
  const read = vi.fn(overrides.read ?? (async () => FACTS));
  const app = createAccountSecurityFactsRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    facts: { read } as never,
    rateLimit: async () => overrides.rateLimit ?? null,
  });
  const call = (init: { auth?: string; body?: string; contentType?: string } = {}) =>
    app.request("/lax/account-security-facts", {
      method: "POST",
      headers: {
        ...(init.auth === "" ? {} : { Authorization: init.auth ?? basic("lax-account-web") }),
        "Content-Type": init.contentType ?? "application/x-www-form-urlencoded",
      },
      body: init.body ?? "token=access-token",
    });
  return { call, introspect, read };
}

describe("account security facts route", () => {
  it("returns the facts of the subject that owns the access token", async () => {
    const { call, introspect, read } = setup({});
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(FACTS);
    expect(introspect).toHaveBeenCalledWith({
      requesterClientId: "lax-account-web",
      token: "access-token",
      tokenTypeHint: "access_token",
    });
    expect(read).toHaveBeenCalledWith(ACCOUNT_SUBJECT);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("ignores any subject the caller tries to name, so one person cannot read another", async () => {
    const { call, read } = setup({});
    await call({ body: "token=access-token&sub=22222222-2222-4222-8222-222222222222&userId=x" });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(ACCOUNT_SUBJECT);
  });

  it("rejects a token that is inactive or belongs to another client", async () => {
    const { call, read } = setup({ introspection: { active: false } });
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_token" });
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects bad client credentials", async () => {
    const { call, introspect } = setup({ client: null });
    const response = await call();
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Basic");
    expect(introspect).not.toHaveBeenCalled();
  });

  it("rejects a request with no client credentials", async () => {
    const { call } = setup({ client: null });
    expect((await call({ auth: "" })).status).toBe(401);
  });

  it("refuses every client except LAX Account, even with a valid secret and token", async () => {
    const { call, introspect, read } = setup({ client: "lax-bid-web" });
    const response = await call({ auth: basic("lax-bid-web") });
    expect(response.status).toBe(403);
    expect(introspect).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("requires a form-encoded body with exactly one token", async () => {
    const { call } = setup({});
    expect((await call({ contentType: "application/json", body: "{}" })).status).toBe(400);
    expect((await call({ body: "" })).status).toBe(400);
    expect((await call({ body: "token=a&token=b" })).status).toBe(400);
  });

  it("answers 429 with Retry-After when the subject is over budget", async () => {
    const { call, read } = setup({ rateLimit: 17 });
    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(read).not.toHaveBeenCalled();
  });

  it("answers 503 without leaking the cause when the read fails", async () => {
    const { call } = setup({
      read: async () => {
        throw new Error("password authentication failed for user app_secret");
      },
    });
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("app_secret");
  });

  it("treats a deleted subject like an invalid token", async () => {
    const { call } = setup({ read: async () => null });
    expect((await call()).status).toBe(401);
  });

  it("never passes through fields beyond the three documented facts", async () => {
    const { call } = setup({
      read: async () => ({ ...FACTS, backupCodes: ["AAAAA-BBBBB"], secret: "totp-secret" }),
    });
    const text = await (await call()).text();
    expect(JSON.parse(text)).toEqual(FACTS);
    expect(text).not.toContain("AAAAA-BBBBB");
    expect(text).not.toContain("totp-secret");
  });
});
