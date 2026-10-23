import { describe, expect, it, vi } from "vitest";
import { createAccountBackupCodesRoutes } from "./account-backup-codes.routes.js";

const PATH = "/lax/account-backup-codes/regenerate";
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "22222222-2222-4222-8222-222222222222";
const CODES = ["abcde-12345", "fghij-67890"];

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
  const backupCodes = {
    regenerate: vi.fn().mockResolvedValue(overrides.result ?? { ok: true, backupCodes: CODES }),
  };
  const onFailure = vi.fn();
  const app = createAccountBackupCodesRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    rateLimit: async () => overrides.rateLimit ?? null,
    backupCodes,
    onFailure,
  });
  const call = (body: string, auth = basic("lax-account-web")) =>
    app.request(PATH, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  return { call, backupCodes, introspect, onFailure };
}

describe("account backup codes route", () => {
  it("returns the new codes, uncached", async () => {
    const { call, backupCodes } = setup();
    const response = await call("token=t&sid=current");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ backupCodes: CODES });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(backupCodes.regenerate).toHaveBeenCalledWith(SUBJECT, "current");
  });

  it("refuses every client except LAX Account, before looking at the token", async () => {
    const { call, introspect, backupCodes } = setup({ client: "lax-bid-web" });
    expect((await call("token=t&sid=current", basic("lax-bid-web"))).status).toBe(403);
    expect(introspect).not.toHaveBeenCalled();
    expect(backupCodes.regenerate).not.toHaveBeenCalled();
  });

  it("refuses bad client credentials and inactive tokens", async () => {
    expect((await setup({ client: null }).call("token=t&sid=current")).status).toBe(401);
    const inactive = setup({ introspection: { active: false } });
    expect((await inactive.call("token=t&sid=current")).status).toBe(401);
    expect(inactive.backupCodes.regenerate).not.toHaveBeenCalled();
  });

  it("acts only for the person who owns the access token, whatever the body names", async () => {
    const { call, backupCodes } = setup();
    await call(`token=t&sid=current&sub=${OTHER_SUBJECT}&userId=${OTHER_SUBJECT}`);
    expect(backupCodes.regenerate).toHaveBeenCalledWith(SUBJECT, "current");
    expect(backupCodes.regenerate).not.toHaveBeenCalledWith(OTHER_SUBJECT, expect.anything());
  });

  it("asks for a fresh sign-in when the session is not recent enough, and returns no codes", async () => {
    const { call } = setup({ result: { ok: false, reason: "reauth_required" } });
    const response = await call("token=t&sid=current");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "reauth_required" });
  });

  it("says so when two-step verification is off", async () => {
    const { call } = setup({ result: { ok: false, reason: "two_factor_not_enabled" } });
    const response = await call("token=t&sid=current");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "two_factor_not_enabled" });
  });

  it("requires the caller's sign-in id", async () => {
    const { call, backupCodes } = setup();
    expect((await call("token=t")).status).toBe(400);
    expect(backupCodes.regenerate).not.toHaveBeenCalled();
  });

  it("answers 429 when the person is over their budget", async () => {
    const { call, backupCodes } = setup({ rateLimit: 30 });
    expect((await call("token=t&sid=current")).status).toBe(429);
    expect(backupCodes.regenerate).not.toHaveBeenCalled();
  });

  it("maps an unexpected failure to a generic 503 that leaks nothing", async () => {
    const { call, backupCodes, onFailure } = setup();
    backupCodes.regenerate.mockRejectedValue(new Error("db down: secret-detail"));
    const response = await call("token=t&sid=current");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-detail");
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
