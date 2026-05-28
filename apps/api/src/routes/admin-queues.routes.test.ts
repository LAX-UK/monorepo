import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminQueuesRoutes } from "./admin-queues.js";

function createQueueTestApp(staffRole: string | null) {
  const list = vi.fn().mockResolvedValue([{ name: "email", paused: false, counts: { failed: 0 } }]);
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test", APP_ENV: "development" } as never,
    queueAdmin: {
      inspector: { list, jobs: vi.fn(), job: vi.fn() },
      mutator: { retry: vi.fn(), pause: vi.fn(), resume: vi.fn(), replayFromDlq: vi.fn() },
    },
  };

  const app = new Hono<{
    Variables: { userId?: string; userStaffRole?: string | null };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "admin-user-id");
    c.set("userStaffRole", staffRole);
    await next();
  });
  attachAdminQueuesRoutes(app, container as never);
  return { app, list };
}

describe("admin queue routes", () => {
  it("GET /system/job-queues returns inspector list for super_admin", async () => {
    const { app, list } = createQueueTestApp("super_admin");
    const res = await app.request("http://test/system/job-queues");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ name: string }> };
    expect(body.data[0]?.name).toBe("email");
    expect(list).toHaveBeenCalledOnce();
  });

  it("returns 403 for non-super-admin staff", async () => {
    const { app } = createQueueTestApp("auction_manager");
    const res = await app.request("http://test/system/job-queues");
    expect(res.status).toBe(403);
  });

  it("returns 403 for pause on high-criticality queue in production", async () => {
    const pause = vi.fn().mockRejectedValue(new Error("mutations_disabled_in_prod"));
    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test", APP_ENV: "development" } as never,
      queueAdmin: {
        inspector: { list: vi.fn(), jobs: vi.fn(), job: vi.fn() },
        mutator: { retry: vi.fn(), pause, resume: vi.fn(), replayFromDlq: vi.fn() },
      },
    };
    const app = new Hono<{
      Variables: { userId?: string; userStaffRole?: string | null };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "admin-user-id");
      c.set("userStaffRole", "super_admin");
      await next();
    });
    attachAdminQueuesRoutes(app, container as never);
    const res = await app.request("http://test/system/job-queues/email/pause", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("masks internal retry errors", async () => {
    const retry = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const container = {
      env: { LOG_LEVEL: "silent", NODE_ENV: "test", APP_ENV: "development" } as never,
      queueAdmin: {
        inspector: { list: vi.fn(), jobs: vi.fn(), job: vi.fn() },
        mutator: { retry, pause: vi.fn(), resume: vi.fn(), replayFromDlq: vi.fn() },
      },
    };
    const app = new Hono<{ Variables: { userId?: string; userStaffRole?: string | null } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "admin-user-id");
      c.set("userStaffRole", "super_admin");
      await next();
    });
    attachAdminQueuesRoutes(app, container as never);
    const res = await app.request("http://test/system/job-queues/email/jobs/job-1/retry", {
      method: "POST",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "retry_failed" });
  });
});
