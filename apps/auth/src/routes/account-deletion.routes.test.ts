import { describe, expect, it, vi } from "vitest";
import { createAccountDeletionRoutes } from "./account-deletion.routes.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "22222222-2222-4222-8222-222222222222";
const PHRASE = "DELETE+MY+ACCOUNT";

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

function setup(
  overrides: {
    client?: string | null;
    introspection?: unknown;
    statusLimit?: number | null;
    changeLimit?: number | null;
  } = {},
) {
  const introspect = vi
    .fn()
    .mockResolvedValue(overrides.introspection ?? { active: true, sub: SUBJECT });
  const deletion = {
    status: vi.fn().mockResolvedValue({
      requestedAt: null,
      products: [
        { product: "bid", state: "clear", blockers: [] },
        { product: "shop", state: "clear", blockers: [] },
      ],
    }),
    requestDeletionWithStepUp: vi.fn().mockResolvedValue({
      ok: true,
      outcome: { outcome: "requested", requestedAt: "2026-10-23T12:00:00.000Z" },
    }),
    cancelDeletion: vi.fn().mockResolvedValue({ ok: true, outcome: "cancelled" }),
  };
  const onFailure = vi.fn();
  const app = createAccountDeletionRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    deletion: deletion as never,
    statusRateLimit: async () => overrides.statusLimit ?? null,
    changeRateLimit: async () => overrides.changeLimit ?? null,
    onFailure,
  });
  const call = (path: string, body: string, auth = basic("lax-account-web")) =>
    app.request(path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  return { call, deletion, introspect, onFailure };
}

const ROUTES: [string, string][] = [
  ["/lax/account-deletion", "token=t"],
  ["/lax/account-deletion/request", `token=t&sid=current&confirmation=${PHRASE}`],
  ["/lax/account-deletion/cancel", "token=t&sid=current"],
];

describe("account deletion routes", () => {
  it.each(ROUTES)("%s refuses every client except LAX Account", async (path, body) => {
    const { call, introspect } = setup({ client: "lax-bid-web" });
    expect((await call(path, body, basic("lax-bid-web"))).status).toBe(403);
    expect(introspect).not.toHaveBeenCalled();
  });

  it.each(ROUTES)("%s refuses bad client credentials", async (path, body) => {
    const { call } = setup({ client: null });
    expect((await call(path, body)).status).toBe(401);
  });

  it.each(ROUTES)("%s rejects an inactive token and touches nothing", async (path, body) => {
    const { call, deletion } = setup({ introspection: { active: false } });
    expect((await call(path, body)).status).toBe(401);
    for (const fn of Object.values(deletion)) expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    ["/lax/account-deletion", "statusLimit"],
    ["/lax/account-deletion/request", "changeLimit"],
    ["/lax/account-deletion/cancel", "changeLimit"],
  ] as const)("%s answers 429 over its own budget", async (path, limit) => {
    const body = ROUTES.find(([p]) => p === path)?.[1] ?? "";
    const { call, deletion } = setup({ [limit]: 45 });
    const response = await call(path, body);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
    for (const fn of Object.values(deletion)) expect(fn).not.toHaveBeenCalled();
  });

  it("acts only for the person who owns the access token, whatever the body names", async () => {
    const { call, deletion } = setup();
    await call(
      "/lax/account-deletion/request",
      `token=t&sid=current&confirmation=${PHRASE}&sub=${OTHER_SUBJECT}&userId=${OTHER_SUBJECT}`,
    );
    expect(deletion.requestDeletionWithStepUp).toHaveBeenCalledWith(SUBJECT, "current");
  });

  it("reads the combined status with no-store caching", async () => {
    const { call, deletion } = setup();
    const response = await call("/lax/account-deletion", "token=t");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ requestedAt: null });
    expect(deletion.status).toHaveBeenCalledWith(SUBJECT);
  });

  it("requests deletion when the phrase is typed exactly", async () => {
    const { call } = setup();
    const response = await call(
      "/lax/account-deletion/request",
      `token=t&sid=current&confirmation=${PHRASE}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outcome: "requested",
      requestedAt: "2026-10-23T12:00:00.000Z",
    });
  });

  it.each([
    ["no phrase", "token=t&sid=current"],
    ["the wrong phrase", "token=t&sid=current&confirmation=delete+my+account"],
    ["a partial phrase", "token=t&sid=current&confirmation=DELETE"],
    ["no sid", `token=t&confirmation=${PHRASE}`],
  ])("refuses a deletion request with %s without asking any product", async (_label, body) => {
    const { call, deletion } = setup();
    expect((await call("/lax/account-deletion/request", body)).status).toBe(400);
    expect(deletion.requestDeletionWithStepUp).not.toHaveBeenCalled();
  });

  it("answers 403 reauth_required when the sign-in is too old", async () => {
    const { call, deletion } = setup();
    deletion.requestDeletionWithStepUp.mockResolvedValue({ ok: false, reason: "reauth_required" });
    const response = await call(
      "/lax/account-deletion/request",
      `token=t&sid=current&confirmation=${PHRASE}`,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "reauth_required" });
  });

  it("returns blockers as an outcome with HTTP 200", async () => {
    const { call, deletion } = setup();
    const status = {
      requestedAt: null,
      products: [
        {
          product: "bid",
          state: "blocked",
          blockers: [{ code: "pay", message: "Pay it.", href: null }],
        },
      ],
    };
    deletion.requestDeletionWithStepUp.mockResolvedValue({
      ok: true,
      outcome: { outcome: "not_eligible", status },
    });
    const response = await call(
      "/lax/account-deletion/request",
      `token=t&sid=current&confirmation=${PHRASE}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "not_eligible", status });
  });

  it("cancels, and says when there was nothing to cancel", async () => {
    const { call, deletion } = setup();
    expect(
      await (await call("/lax/account-deletion/cancel", "token=t&sid=current")).json(),
    ).toEqual({
      outcome: "cancelled",
    });
    deletion.cancelDeletion.mockResolvedValue({ ok: true, outcome: "not_requested" });
    expect(
      await (await call("/lax/account-deletion/cancel", "token=t&sid=current")).json(),
    ).toEqual({
      outcome: "not_requested",
    });
  });

  it("requires a sid to cancel and answers 403 when the sign-in has ended", async () => {
    const { call, deletion } = setup();
    expect((await call("/lax/account-deletion/cancel", "token=t")).status).toBe(400);
    deletion.cancelDeletion.mockResolvedValue({ ok: false, reason: "reauth_required" });
    expect((await call("/lax/account-deletion/cancel", "token=t&sid=gone")).status).toBe(403);
  });

  it("answers 503 without leaking the cause when the work fails", async () => {
    const { call, deletion, onFailure } = setup();
    deletion.status.mockRejectedValue(new Error("password for app_secret rejected"));
    const response = await call("/lax/account-deletion", "token=t");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("app_secret");
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
