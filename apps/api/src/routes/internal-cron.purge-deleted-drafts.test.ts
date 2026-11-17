import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

const CRON_SECRET = "test-cron-secret";

function setup() {
  const purgeDeletedSubmissionDrafts = vi
    .fn()
    .mockResolvedValue({ purged: 3, photos: 5, photoFailures: 0 });
  const container = {
    finance: {},
    platformCron: { lifecycle: {}, hygiene: { purgeDeletedSubmissionDrafts } },
    absenteeBidService: {},
  } as unknown as ContainerInternalCronRoutesSlice;
  const env = { CRON_INTERNAL_SECRET: CRON_SECRET } as Env;
  const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
  return { app, purgeDeletedSubmissionDrafts };
}

describe("POST /internal/jobs/purge-deleted-submission-drafts (GAP-53)", () => {
  it("rejects a request without the cron secret and removes nothing", async () => {
    const { app, purgeDeletedSubmissionDrafts } = setup();
    const res = await app.request("/internal/jobs/purge-deleted-submission-drafts", {
      method: "POST",
    });
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(404);
    expect(purgeDeletedSubmissionDrafts).not.toHaveBeenCalled();
  });

  it("purges the due drafts and returns the counts", async () => {
    const { app, purgeDeletedSubmissionDrafts } = setup();
    const res = await app.request("/internal/jobs/purge-deleted-submission-drafts", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { purged: 3, photos: 5, photoFailures: 0 } });
    expect(purgeDeletedSubmissionDrafts).toHaveBeenCalledOnce();
  });
});
