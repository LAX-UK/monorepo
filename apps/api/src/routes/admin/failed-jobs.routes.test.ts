import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminFailedJobsRoutes } from "./failed-jobs.routes.js";

const batch = { results: [{ id: "dlq:email:1", ok: true }] };

function createApp(staffRoles: StaffRoles | undefined) {
  const failedJobs = {
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    detail: vi.fn().mockResolvedValue({ id: "dlq:email:1" }),
    retry: vi.fn().mockResolvedValue(batch),
    discard: vi.fn().mockResolvedValue(batch),
    restore: vi.fn().mockResolvedValue(batch),
  };
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test", APP_ENV: "development" },
    admin: { failedJobs },
  };
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  attachAdminFailedJobsRoutes(app as never, container as never);
  return { app, failedJobs };
}

const json = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("failed jobs routes", () => {
  it("lists with the default view and sort", async () => {
    const { app, failedJobs } = createApp(["administrator"]);
    const res = await app.request("http://test/system/failed-jobs");
    expect(res.status).toBe(200);
    expect(failedJobs.list).toHaveBeenCalledWith(
      expect.objectContaining({ view: "needs_review", sort: "failed_desc", limit: 50, offset: 0 }),
    );
  });

  it("rejects an unknown view and a malformed day", async () => {
    const { app } = createApp(["administrator"]);
    expect((await app.request("http://test/system/failed-jobs?view=all")).status).toBe(400);
    expect((await app.request("http://test/system/failed-jobs?from=yesterday")).status).toBe(400);
  });

  it("returns one job, or 404", async () => {
    const { app, failedJobs } = createApp(["administrator"]);
    const ok = await app.request("http://test/system/failed-jobs/dlq%3Aemail%3A1");
    expect(ok.status).toBe(200);
    expect(failedJobs.detail).toHaveBeenCalledWith("dlq:email:1");
    failedJobs.detail.mockResolvedValue(null);
    const missing = await app.request("http://test/system/failed-jobs/nope");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "job_not_found" });
  });

  it("retries with the repeat confirmation and the acting person", async () => {
    const { app, failedJobs } = createApp(["administrator"]);
    const res = await app.request(
      "http://test/system/failed-jobs/retry",
      json({ ids: ["dlq:email:1"], confirmRepeat: true }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: batch });
    expect(failedJobs.retry).toHaveBeenCalledWith(
      ["dlq:email:1"],
      true,
      expect.objectContaining({ userId: "staff-1" }),
    );
  });

  it("does not assume the repeat is confirmed", async () => {
    const { app, failedJobs } = createApp(["administrator"]);
    await app.request("http://test/system/failed-jobs/retry", json({ ids: ["a"] }));
    expect(failedJobs.retry).toHaveBeenCalledWith(["a"], false, expect.anything());
  });

  it("limits a batch to fifty jobs and needs at least one", async () => {
    const { app } = createApp(["administrator"]);
    const many = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    expect(
      (await app.request("http://test/system/failed-jobs/retry", json({ ids: many }))).status,
    ).toBe(400);
    expect(
      (await app.request("http://test/system/failed-jobs/retry", json({ ids: [] }))).status,
    ).toBe(400);
  });

  it("discards with a reason, and needs a note for other", async () => {
    const { app, failedJobs } = createApp(["administrator"]);
    const ok = await app.request(
      "http://test/system/failed-jobs/discard",
      json({ ids: ["a"], reason: "duplicate" }),
    );
    expect(ok.status).toBe(200);
    expect(failedJobs.discard).toHaveBeenCalledWith(
      ["a"],
      "duplicate",
      undefined,
      expect.anything(),
    );
    const noNote = await app.request(
      "http://test/system/failed-jobs/discard",
      json({ ids: ["a"], reason: "other" }),
    );
    expect(noNote.status).toBe(400);
    const badReason = await app.request(
      "http://test/system/failed-jobs/discard",
      json({ ids: ["a"], reason: "because" }),
    );
    expect(badReason.status).toBe(400);
  });

  it("restores discarded jobs", async () => {
    const { app, failedJobs } = createApp(["administrator"]);
    const res = await app.request("http://test/system/failed-jobs/restore", json({ ids: ["a"] }));
    expect(res.status).toBe(200);
    expect(failedJobs.restore).toHaveBeenCalledWith(["a"], expect.anything());
  });

  it("lets read-only staff look but not act", async () => {
    const { app, failedJobs } = createApp(["read_only"]);
    expect((await app.request("http://test/system/failed-jobs")).status).toBe(200);
    const retry = await app.request("http://test/system/failed-jobs/retry", json({ ids: ["a"] }));
    expect(retry.status).toBe(403);
    const discard = await app.request(
      "http://test/system/failed-jobs/discard",
      json({ ids: ["a"], reason: "duplicate" }),
    );
    expect(discard.status).toBe(403);
    expect(failedJobs.retry).not.toHaveBeenCalled();
    expect(failedJobs.discard).not.toHaveBeenCalled();
  });

  it("keeps everyone else out", async () => {
    const { app } = createApp(["sales_manager"]);
    expect((await app.request("http://test/system/failed-jobs")).status).toBe(403);
    expect((await app.request("http://test/system/failed-jobs/dlq%3Aemail%3A1")).status).toBe(403);
  });
});
