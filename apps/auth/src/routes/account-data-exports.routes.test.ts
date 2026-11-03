import { describe, expect, it, vi } from "vitest";
import { SubjectExportStorageUnavailableError } from "../services/subject-export.service.js";
import { createAccountDataExportRoutes } from "./account-data-exports.routes.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "22222222-2222-4222-8222-222222222222";
const EXPORT_ID = "33333333-3333-4333-8333-333333333333";

function basic(clientId: string): string {
  return `Basic ${Buffer.from(`${clientId}:client-secret`).toString("base64")}`;
}

function setup(
  overrides: {
    client?: string | null;
    introspection?: unknown;
    readLimit?: number | null;
    changeLimit?: number | null;
  } = {},
) {
  const introspect = vi
    .fn()
    .mockResolvedValue(overrides.introspection ?? { active: true, sub: SUBJECT });
  const exports = {
    current: vi.fn().mockResolvedValue(null),
    request: vi.fn().mockResolvedValue({
      ok: true,
      outcome: { outcome: "rate_limited", retryAfter: "2026-11-20T00:00:00.000Z" },
    }),
    download: vi.fn().mockResolvedValue({
      ok: true,
      result: {
        outcome: "signed",
        url: "https://bucket.example/f?sig=1",
        expiresAt: "2026-10-23T12:05:00.000Z",
      },
    }),
    deleteCopy: vi.fn().mockResolvedValue({ ok: true, outcome: "deleted" }),
  };
  const onFailure = vi.fn();
  const app = createAccountDataExportRoutes({
    clients: {
      authenticate: async () =>
        (overrides.client === undefined ? "lax-account-web" : overrides.client) as never,
    },
    tokens: { introspect } as never,
    exports: exports as never,
    readRateLimit: async () => overrides.readLimit ?? null,
    changeRateLimit: async () => overrides.changeLimit ?? null,
    onFailure,
  });
  const call = (path: string, body: string, auth = basic("lax-account-web")) =>
    app.request(path, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  return { call, exports, introspect, onFailure };
}

const ROUTES: [string, string][] = [
  ["/lax/data-exports/current", "token=t"],
  ["/lax/data-exports", "token=t&sid=current"],
  ["/lax/data-exports/download", `token=t&sid=current&id=${EXPORT_ID}`],
  ["/lax/data-exports/delete", `token=t&sid=current&id=${EXPORT_ID}`],
];

describe("account data export routes", () => {
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
    const { call, exports } = setup({ introspection: { active: false } });
    expect((await call(path, body)).status).toBe(401);
    for (const fn of Object.values(exports)) expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    ["/lax/data-exports/current", "readLimit"],
    ["/lax/data-exports", "changeLimit"],
    ["/lax/data-exports/download", "changeLimit"],
    ["/lax/data-exports/delete", "changeLimit"],
  ] as const)("%s answers 429 over its own budget", async (path, limit) => {
    const body = ROUTES.find(([p]) => p === path)?.[1] ?? "";
    const { call, exports } = setup({ [limit]: 45 });
    const response = await call(path, body);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
    for (const fn of Object.values(exports)) expect(fn).not.toHaveBeenCalled();
  });

  it("acts only for the person who owns the access token, whatever the body names", async () => {
    const { call, exports } = setup();
    await call(
      "/lax/data-exports/download",
      `token=t&sid=current&id=${EXPORT_ID}&sub=${OTHER_SUBJECT}&userId=${OTHER_SUBJECT}`,
    );
    expect(exports.download).toHaveBeenCalledWith(SUBJECT, EXPORT_ID, {
      sessionId: "current",
      ipAddress: null,
      userAgent: null,
    });
  });

  it("reads the latest request with no-store caching", async () => {
    const { call, exports } = setup();
    const response = await call("/lax/data-exports/current", "token=t");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ export: null });
    expect(exports.current).toHaveBeenCalledWith(SUBJECT);
  });

  it("passes the person's browser and address on, bounded, when asking for a copy", async () => {
    const { call, exports } = setup();
    const long = "x".repeat(2_000);
    const response = await call(
      "/lax/data-exports",
      `token=t&sid=current&ip=203.0.113.7&user_agent=${long}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outcome: "rate_limited",
      retryAfter: "2026-11-20T00:00:00.000Z",
    });
    expect(exports.request).toHaveBeenCalledWith(SUBJECT, {
      sessionId: "current",
      ipAddress: "203.0.113.7",
      userAgent: "x".repeat(512),
    });
  });

  it.each([
    ["/lax/data-exports", "token=t"],
    ["/lax/data-exports/download", `token=t&id=${EXPORT_ID}`],
    ["/lax/data-exports/download", "token=t&sid=current"],
    ["/lax/data-exports/delete", "token=t&sid=current"],
  ])("%s refuses a request missing sid or id (%s)", async (path, body) => {
    const { call, exports } = setup();
    expect((await call(path, body)).status).toBe(400);
    expect(exports.request).not.toHaveBeenCalled();
    expect(exports.download).not.toHaveBeenCalled();
    expect(exports.deleteCopy).not.toHaveBeenCalled();
  });

  it.each([
    ["/lax/data-exports", "request"],
    ["/lax/data-exports/download", "download"],
    ["/lax/data-exports/delete", "deleteCopy"],
  ] as const)("%s answers 403 reauth_required when the sign-in is too old", async (path, fn) => {
    const { call, exports } = setup();
    exports[fn].mockResolvedValue({ ok: false, reason: "reauth_required" });
    const response = await call(path, `token=t&sid=current&id=${EXPORT_ID}`);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "reauth_required" });
  });

  it("returns the one signed link on download", async () => {
    const { call } = setup();
    const response = await call(
      "/lax/data-exports/download",
      `token=t&sid=current&id=${EXPORT_ID}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://bucket.example/f?sig=1",
      expiresAt: "2026-10-23T12:05:00.000Z",
    });
  });

  it("answers 404 for another person's copy and 410 for one that is gone", async () => {
    const { call, exports } = setup();
    exports.download.mockResolvedValueOnce({ ok: true, result: { outcome: "not_found" } });
    expect(
      (await call("/lax/data-exports/download", `token=t&sid=current&id=${EXPORT_ID}`)).status,
    ).toBe(404);
    exports.download.mockResolvedValueOnce({ ok: true, result: { outcome: "unavailable" } });
    expect(
      (await call("/lax/data-exports/download", `token=t&sid=current&id=${EXPORT_ID}`)).status,
    ).toBe(410);
  });

  it("deletes a copy and reports the outcome", async () => {
    const { call, exports } = setup();
    const response = await call("/lax/data-exports/delete", `token=t&sid=current&id=${EXPORT_ID}`);
    expect(await response.json()).toEqual({ outcome: "deleted" });
    expect(exports.deleteCopy).toHaveBeenCalledWith(SUBJECT, EXPORT_ID, "current");
  });

  it("answers 503 when the service fails, and says so when the bucket is not configured", async () => {
    const { call, exports, onFailure } = setup();
    exports.current.mockRejectedValueOnce(new Error("db down"));
    const failed = await call("/lax/data-exports/current", "token=t");
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "temporarily_unavailable" });
    exports.download.mockRejectedValueOnce(new SubjectExportStorageUnavailableError());
    const noBucket = await call(
      "/lax/data-exports/download",
      `token=t&sid=current&id=${EXPORT_ID}`,
    );
    expect(noBucket.status).toBe(503);
    expect(await noBucket.json()).toEqual({ error: "download_unavailable" });
    expect(onFailure).toHaveBeenCalledTimes(2);
  });
});
