import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

const CRON_SECRET = "test-cron-secret";

function setup(configured = true) {
  const run = vi.fn().mockResolvedValue({ checked: 2, settled: 1, stillPending: 1, failed: 0 });
  const container = {
    finance: {},
    platformCron: {
      lifecycle: {},
      hygiene: {},
      stripeRefundReconcile: configured ? { run } : null,
    },
    absenteeBidService: {},
  } as unknown as ContainerInternalCronRoutesSlice;
  const env = { CRON_INTERNAL_SECRET: CRON_SECRET } as Env;
  const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
  return { app, run };
}

describe("POST /internal/jobs/stripe-refund-reconcile", () => {
  it("rejects a request without the cron secret and does no work", async () => {
    const { app, run } = setup();
    const res = await app.request("/internal/jobs/stripe-refund-reconcile", { method: "POST" });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(404);
    expect(run).not.toHaveBeenCalled();
  });

  it("settles a batch of watched refunds and returns the counts", async () => {
    const { app, run } = setup();
    const res = await app.request("/internal/jobs/stripe-refund-reconcile", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: { checked: 2, settled: 1, stillPending: 1, failed: 0 },
    });
    expect(run).toHaveBeenCalledOnce();
  });

  it("answers without work where Stripe payments are not set up", async () => {
    const { app } = setup(false);
    const res = await app.request("/internal/jobs/stripe-refund-reconcile", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { skipped: "stripe_not_configured" } });
  });
});
