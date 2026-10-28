import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

const CRON_SECRET = "test-cron-secret";

function setup() {
  const expireEndedRoles = vi.fn().mockResolvedValue({ expired: 2, people: 1 });
  const container = {
    finance: {},
    platformCron: { lifecycle: {}, hygiene: {}, staffRoles: { expireEndedRoles } },
    absenteeBidService: {},
  } as unknown as ContainerInternalCronRoutesSlice;
  const env = { CRON_INTERNAL_SECRET: CRON_SECRET } as Env;
  const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
  return { app, expireEndedRoles };
}

describe("POST /internal/jobs/staff-role-expiry", () => {
  it("rejects a request without the cron secret and does no work", async () => {
    const { app, expireEndedRoles } = setup();
    const res = await app.request("/internal/jobs/staff-role-expiry", { method: "POST" });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(404);
    expect(expireEndedRoles).not.toHaveBeenCalled();
  });

  it("records ended roles and returns the counts", async () => {
    const { app, expireEndedRoles } = setup();
    const res = await app.request("/internal/jobs/staff-role-expiry", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { expired: 2, people: 1 } });
    expect(expireEndedRoles).toHaveBeenCalledOnce();
  });
});
