import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

const CRON_SECRET = "test-cron-secret";

function setup() {
  const sendDue = vi.fn().mockResolvedValue({ sent: 3, dropped: 1 });
  const container = {
    finance: {},
    platformCron: { lifecycle: {}, hygiene: {}, staffRoles: {}, watchedLotReminders: { sendDue } },
    absenteeBidService: {},
  } as unknown as ContainerInternalCronRoutesSlice;
  const env = { CRON_INTERNAL_SECRET: CRON_SECRET } as Env;
  const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
  return { app, sendDue };
}

describe("POST /internal/jobs/watched-lot-reminders", () => {
  it("rejects a request without the cron secret and sends nothing", async () => {
    const { app, sendDue } = setup();
    const res = await app.request("/internal/jobs/watched-lot-reminders", { method: "POST" });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(404);
    expect(sendDue).not.toHaveBeenCalled();
  });

  it("sends the due reminders and returns the counts", async () => {
    const { app, sendDue } = setup();
    const res = await app.request("/internal/jobs/watched-lot-reminders", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { sent: 3, dropped: 1 } });
    expect(sendDue).toHaveBeenCalledOnce();
  });
});
