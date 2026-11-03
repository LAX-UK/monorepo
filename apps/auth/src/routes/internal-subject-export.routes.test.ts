import { describe, expect, it, vi } from "vitest";
import type { SubjectExportProgressResult } from "../services/subject-export.service.js";
import { UnknownSubjectExportCategoryError } from "../subject-export/subject-export-reader.service.js";
import { InvalidSubjectExportCursorError } from "../subject-export/subject-export.types.js";
import { createInternalIdentityRoutes } from "./internal-identity.routes.js";
import { subjectExportTokenKey } from "./internal-subject-export.routes.js";

const EXPORT_ID = "33333333-3333-4333-8333-333333333333";
const LIFECYCLE_BASIC = Buffer.from("api-service:machine-secret-at-least-32-characters").toString(
  "base64",
);
const EXPORT_BASIC = Buffer.from(
  "subject-export-worker:export-secret-at-least-32-characters",
).toString("base64");
const SHA = "b".repeat(64);

function setup(
  options: { exportLimit?: number | null; readLimit?: number | null; withExport?: boolean } = {},
) {
  const store = new Map<string, string>();
  const applyProgress = vi.fn<(...args: unknown[]) => Promise<SubjectExportProgressResult>>(
    async () => "applied",
  );
  const rateLimit = vi.fn(async () => options.exportLimit ?? null);
  const readRateLimit = vi.fn(async () => options.readLimit ?? null);
  const manifest = vi.fn(async () => ({ product: "account", categories: [] }));
  const page = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    records: [],
    nextCursor: null,
  }));
  const lifecycle = { disable: vi.fn(async () => undefined), enable: vi.fn(), merge: vi.fn() };
  const app = createInternalIdentityRoutes({
    lifecycle: lifecycle as never,
    operations: {} as never,
    emailChange: {} as never,
    accountDeletion: {} as never,
    redis: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => {
        store.set(key, value);
      },
      del: async (key) => {
        store.delete(key);
      },
      incr: async (key) => {
        const next = Number(store.get(key) ?? 0) + 1;
        store.set(key, String(next));
        return next;
      },
      expire: async () => 1,
      ttl: async () => 60,
    },
    machineClientId: "api-service",
    machineClientSecret: "machine-secret-at-least-32-characters",
    ...(options.withExport === false
      ? {}
      : {
          subjectExport: {
            exports: { applyProgress },
            reader: { manifest, page } as never,
            redis: { get: async (key: string) => store.get(key) ?? null },
            clientId: "subject-export-worker",
            clientSecret: "export-secret-at-least-32-characters",
            rateLimit,
            readRateLimit,
          },
        }),
  });
  const token = async (basic: string, scope: string) =>
    app.request("/oauth/token", {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=client_credentials&scope=${scope}`,
    });
  const progress = (bearer: string | null, body: unknown, id = EXPORT_ID) =>
    app.request(`/identity/subject-exports/${id}/progress`, {
      method: "POST",
      headers: {
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const read = (bearer: string | null, path: string) =>
    app.request(`/identity/subjects/person-1/export${path}`, {
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    });
  return {
    app,
    token,
    progress,
    read,
    manifest,
    page,
    readRateLimit,
    applyProgress,
    rateLimit,
    lifecycle,
    store,
  };
}

async function exportToken(ctx: ReturnType<typeof setup>): Promise<string> {
  const response = await ctx.token(EXPORT_BASIC, "subject_export");
  expect(response.status).toBe(200);
  return ((await response.json()) as { access_token: string }).access_token;
}

describe("subject export machine credential", () => {
  it("issues a subject_export token only to the export client", async () => {
    const ctx = setup();
    const response = await ctx.token(EXPORT_BASIC, "subject_export");
    expect(await response.json()).toMatchObject({ scope: "subject_export", expires_in: 300 });
    expect((await ctx.token(LIFECYCLE_BASIC, "subject_export")).status).toBe(401);
    expect((await ctx.token(EXPORT_BASIC, "identity.lifecycle")).status).toBe(401);
  });

  it("does not offer the scope when no export credential is configured", async () => {
    const ctx = setup({ withExport: false });
    expect((await ctx.token(EXPORT_BASIC, "subject_export")).status).toBe(401);
    expect((await ctx.token(LIFECYCLE_BASIC, "subject_export")).status).toBe(401);
  });

  it("keeps the two credentials apart: neither token works on the other's routes", async () => {
    const ctx = setup();
    const lifecycleToken = (await (
      await ctx.token(LIFECYCLE_BASIC, "identity.lifecycle")
    ).json()) as {
      access_token: string;
    };
    const progressWithLifecycle = await ctx.progress(lifecycleToken.access_token, {
      event: "failed",
      errorCode: "x",
    });
    expect(progressWithLifecycle.status).toBe(401);
    expect(ctx.applyProgress).not.toHaveBeenCalled();

    const lifecycleWithExport = await ctx.app.request("/identity/subjects/u1/disable", {
      method: "POST",
      headers: {
        authorization: `Bearer ${await exportToken(ctx)}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(lifecycleWithExport.status).toBe(401);
    expect(ctx.lifecycle.disable).not.toHaveBeenCalled();
  });
});

describe("POST /identity/subject-exports/:exportId/progress", () => {
  it("rejects a call without a token or with an unknown one", async () => {
    const ctx = setup();
    expect((await ctx.progress(null, { event: "failed", errorCode: "x" })).status).toBe(401);
    expect((await ctx.progress("nope", { event: "failed", errorCode: "x" })).status).toBe(401);
    expect(ctx.applyProgress).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const ctx = setup();
    const token = await exportToken(ctx);
    ctx.store.delete(subjectExportTokenKey(token));
    expect((await ctx.progress(token, { event: "failed", errorCode: "x" })).status).toBe(401);
  });

  it.each([
    [
      {
        event: "product_collected",
        product: "bid",
        categories: [{ id: "bids", schemaVersion: 1, count: 2 }],
      },
    ],
    [{ event: "delayed", product: "shop", errorCode: "timeout" }],
    [
      {
        event: "ready",
        objectKey: `subject-exports/${EXPORT_ID}/f.zip`,
        fileName: "f.zip",
        sizeBytes: 10,
        sha256: SHA,
      },
    ],
    [{ event: "failed", errorCode: "zip_error" }],
  ])("accepts the report %j", async (report) => {
    const ctx = setup();
    const response = await ctx.progress(await exportToken(ctx), report);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: "applied" });
    expect(ctx.applyProgress).toHaveBeenCalledWith(EXPORT_ID, report);
  });

  it("answers ignored for a repeat, which the worker treats as success", async () => {
    const ctx = setup();
    ctx.applyProgress.mockResolvedValue("ignored");
    const response = await ctx.progress(await exportToken(ctx), {
      event: "failed",
      errorCode: "x",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: "ignored" });
  });

  it.each([
    [{ event: "ready", objectKey: "k", fileName: "f.zip", sizeBytes: 1, sha256: "short" }],
    [{ event: "unknown" }],
    [{ event: "product_collected", product: "other", categories: [] }],
    ["not json"],
  ])("rejects the malformed report %j", async (report) => {
    const ctx = setup();
    expect((await ctx.progress(await exportToken(ctx), report)).status).toBe(400);
    expect(ctx.applyProgress).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a UUID", async () => {
    const ctx = setup();
    const response = await ctx.progress(
      await exportToken(ctx),
      { event: "failed", errorCode: "x" },
      "not-a-uuid",
    );
    expect(response.status).toBe(400);
  });

  it("answers 404, 422 and 503 for the service's other answers", async () => {
    const ctx = setup();
    const token = await exportToken(ctx);
    const report = { event: "failed", errorCode: "x" };
    ctx.applyProgress.mockResolvedValueOnce("not_found");
    expect((await ctx.progress(token, report)).status).toBe(404);
    ctx.applyProgress.mockResolvedValueOnce("invalid_object_key");
    expect((await ctx.progress(token, report)).status).toBe(422);
    ctx.applyProgress.mockRejectedValueOnce(new Error("db down"));
    expect((await ctx.progress(token, report)).status).toBe(503);
  });

  it("answers 429 over the budget for one export", async () => {
    const ctx = setup({ exportLimit: 30 });
    const response = await ctx.progress(await exportToken(ctx), {
      event: "failed",
      errorCode: "x",
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(ctx.applyProgress).not.toHaveBeenCalled();
    expect(ctx.rateLimit).toHaveBeenCalledWith(EXPORT_ID);
  });
});

describe("GET /identity/subjects/:subjectId/export", () => {
  it("answers the manifest for an export token, uncached", async () => {
    const ctx = setup();
    const response = await ctx.read(await exportToken(ctx), "");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ product: "account", categories: [] });
    expect(ctx.manifest).toHaveBeenCalledWith("person-1");
  });

  it("pages a category and passes the cursor on", async () => {
    const ctx = setup();
    const response = await ctx.read(await exportToken(ctx), "/addresses?cursor=abc");
    expect(response.status).toBe(200);
    expect(ctx.page).toHaveBeenCalledWith("person-1", "addresses", "abc");
  });

  it("refuses a call without a token, a lifecycle token, or an expired one", async () => {
    const ctx = setup();
    expect((await ctx.read(null, "")).status).toBe(401);
    const lifecycle = (await (await ctx.token(LIFECYCLE_BASIC, "identity.lifecycle")).json()) as {
      access_token: string;
    };
    expect((await ctx.read(lifecycle.access_token, "")).status).toBe(401);
    const exportAccess = await exportToken(ctx);
    ctx.store.delete(subjectExportTokenKey(exportAccess));
    expect((await ctx.read(exportAccess, "/profile")).status).toBe(401);
    expect(ctx.manifest).not.toHaveBeenCalled();
    expect(ctx.page).not.toHaveBeenCalled();
  });

  it("is rate limited per person", async () => {
    const ctx = setup({ readLimit: 12 });
    const response = await ctx.read(await exportToken(ctx), "/profile");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(ctx.readRateLimit).toHaveBeenCalledWith("person-1");
    expect(ctx.page).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown category and 400 for a bad cursor", async () => {
    const ctx = setup();
    const accessToken = await exportToken(ctx);
    ctx.page.mockRejectedValueOnce(new UnknownSubjectExportCategoryError("nope"));
    expect((await ctx.read(accessToken, "/nope")).status).toBe(404);
    ctx.page.mockRejectedValueOnce(new InvalidSubjectExportCursorError());
    expect((await ctx.read(accessToken, "/profile?cursor=bad")).status).toBe(400);
  });

  it("answers 503 without detail when a reader fails", async () => {
    const ctx = setup();
    ctx.manifest.mockRejectedValueOnce(new Error("db down: secret detail"));
    const response = await ctx.read(await exportToken(ctx), "");
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret detail");
  });
});
