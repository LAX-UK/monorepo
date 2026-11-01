import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

const CRON_SECRET = "test-cron-secret";

function setup() {
  const sweepConsignmentThreads = vi.fn().mockResolvedValue({ repliesNotified: 2, coversEnded: 1 });
  const container = {
    finance: {},
    platformCron: {
      lifecycle: {},
      hygiene: {},
      staffRoles: {},
      consignmentThreads: { sweepConsignmentThreads },
    },
    absenteeBidService: {},
  } as unknown as ContainerInternalCronRoutesSlice;
  const env = { CRON_INTERNAL_SECRET: CRON_SECRET } as Env;
  const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
  return { app, sweepConsignmentThreads };
}

describe("POST /internal/jobs/consignment-thread-sweep", () => {
  it("rejects a request without the cron secret and does no work", async () => {
    const { app, sweepConsignmentThreads } = setup();
    const res = await app.request("/internal/jobs/consignment-thread-sweep", { method: "POST" });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(404);
    expect(sweepConsignmentThreads).not.toHaveBeenCalled();
  });

  it("runs the sweep and returns the counts", async () => {
    const { app, sweepConsignmentThreads } = setup();
    const res = await app.request("/internal/jobs/consignment-thread-sweep", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { repliesNotified: 2, coversEnded: 1 } });
    expect(sweepConsignmentThreads).toHaveBeenCalledOnce();
  });
});
