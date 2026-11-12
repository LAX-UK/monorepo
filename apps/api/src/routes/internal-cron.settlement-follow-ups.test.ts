import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

const CRON_SECRET = "test-cron-secret";

function setup() {
  const raiseNew = vi.fn().mockResolvedValue({ open: 3, raised: 1, urgent: 1 });
  const container = {
    finance: {},
    platformCron: { lifecycle: {}, hygiene: {}, dealSettlementFollowUps: { raiseNew } },
    absenteeBidService: {},
  } as unknown as ContainerInternalCronRoutesSlice;
  const env = { CRON_INTERNAL_SECRET: CRON_SECRET } as Env;
  const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
  return { app, raiseNew };
}

describe("POST /internal/jobs/private-sale-settlement-follow-ups", () => {
  it("rejects a request without the cron secret and does no work", async () => {
    const { app, raiseNew } = setup();
    const res = await app.request("/internal/jobs/private-sale-settlement-follow-ups", {
      method: "POST",
    });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(404);
    expect(raiseNew).not.toHaveBeenCalled();
  });

  it("runs the daily check and returns the counts", async () => {
    const { app, raiseNew } = setup();
    const res = await app.request("/internal/jobs/private-sale-settlement-follow-ups", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { open: 3, raised: 1, urgent: 1 } });
    expect(raiseNew).toHaveBeenCalledOnce();
  });
});
