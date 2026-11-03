import { describe, expect, it, vi } from "vitest";
import { createAccountPasswordRoutes } from "./account-password.routes.js";

const PATH = "/lax/account-password/change";
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "22222222-2222-4222-8222-222222222222";
const BODY = "token=t&sid=current&current_password=Old-password-12&new_password=New-passphrase-34";

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

function setup(
  overrides: {
    client?: string | null;
    introspection?: unknown;
    rateLimit?: number | null;
    result?: unknown;
  } = {},
) {
  const introspect = vi
    .fn()
    .mockResolvedValue(overrides.introspection ?? { active: true, sub: SUBJECT });
  const password = {
    change: vi.fn().mockResolvedValue(overrides.result ?? { ok: true, created: false }),
  };
  const onFailure = vi.fn();
  const app = createAccountPasswordRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    rateLimit: async () => overrides.rateLimit ?? null,
    password,
    onFailure,
  });
  const call = (body: string, auth = basic("lax-account-web")) =>
    app.request(PATH, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  return { call, password, introspect, onFailure };
}

describe("account password route", () => {
  it("changes the password and answers without echoing it, uncached", async () => {
    const { call, password } = setup();
    const response = await call(BODY);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changed: true, created: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(password.change).toHaveBeenCalledWith(SUBJECT, "current", {
      currentPassword: "Old-password-12",
      newPassword: "New-passphrase-34",
    });
  });

  it("sets a first password when no current password is sent", async () => {
    const { call, password } = setup({ result: { ok: true, created: true } });
    const response = await call("token=t&sid=current&new_password=New-passphrase-34");
    expect(await response.json()).toEqual({ changed: true, created: true });
    expect(password.change).toHaveBeenCalledWith(SUBJECT, "current", {
      currentPassword: null,
      newPassword: "New-passphrase-34",
    });
  });

  it("refuses every client except LAX Account, before looking at the token", async () => {
    const { call, introspect, password } = setup({ client: "lax-bid-web" });
    expect((await call(BODY, basic("lax-bid-web"))).status).toBe(403);
    expect(introspect).not.toHaveBeenCalled();
    expect(password.change).not.toHaveBeenCalled();
  });

  it("refuses bad client credentials and inactive tokens", async () => {
    expect((await setup({ client: null }).call(BODY)).status).toBe(401);
    const inactive = setup({ introspection: { active: false } });
    expect((await inactive.call(BODY)).status).toBe(401);
    expect(inactive.password.change).not.toHaveBeenCalled();
  });

  it("acts only for the person who owns the access token, whatever the body names", async () => {
    const { call, password } = setup();
    await call(`${BODY}&sub=${OTHER_SUBJECT}&userId=${OTHER_SUBJECT}`);
    expect(password.change).toHaveBeenCalledWith(SUBJECT, "current", expect.anything());
    expect(password.change).not.toHaveBeenCalledWith(
      OTHER_SUBJECT,
      expect.anything(),
      expect.anything(),
    );
  });

  it("asks for a fresh sign-in when the session is not recent enough", async () => {
    const { call } = setup({ result: { ok: false, reason: "reauth_required" } });
    const response = await call(BODY);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "reauth_required" });
  });

  it.each([
    ["invalid_password", 403],
    ["invalid_password_policy", 422],
    ["password_breached", 422],
    ["same_password", 422],
  ])("maps the refusal %s to %i", async (kind, status) => {
    const { call } = setup({ result: { ok: false, kind } });
    const response = await call(BODY);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
  });

  it("requires the sign-in id and a new password", async () => {
    const { call, password } = setup();
    expect((await call("token=t&new_password=New-passphrase-34")).status).toBe(400);
    expect((await call("token=t&sid=current")).status).toBe(400);
    expect(password.change).not.toHaveBeenCalled();
  });

  it("answers 429 when the person is over their budget, without trying the password", async () => {
    const { call, password } = setup({ rateLimit: 600 });
    const response = await call(BODY);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("600");
    expect(password.change).not.toHaveBeenCalled();
  });

  it("maps an unexpected failure to a generic 503 that leaks no password", async () => {
    const { call, password, onFailure } = setup();
    password.change.mockRejectedValue(new Error("db down: New-passphrase-34"));
    const response = await call(BODY);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("New-passphrase-34");
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
