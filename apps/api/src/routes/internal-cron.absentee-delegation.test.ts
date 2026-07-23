import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerInternalCronRoutesSlice } from "../container.js";
import type { Env } from "../env.js";
import { createInternalCronRoutes } from "./internal-cron.js";

const CRON_SECRET = "test-cron-secret";
const LOT_ID = "00000000-0000-4000-8000-000000000099";

function minimalContainer(): ContainerInternalCronRoutesSlice {
  return {
    finance: {
      internalCron: {},
      accountingCron: {},
      settlementCron: {},
    },
    platformCron: {
      lifecycle: {},
      hygiene: {},
    },
    absenteeBidService: { replayScheduledForLot: vi.fn().mockResolvedValue(undefined) },
  } as unknown as ContainerInternalCronRoutesSlice;
}

function appForEnv(envPartial: Partial<Env>) {
  const env = {
    CRON_INTERNAL_SECRET: CRON_SECRET,
    LIFECYCLE_EXECUTION_OWNER: "api",
    ABSENTEE_REPLAY_OWNER: "api_rollback",
    FINANCE_CRON_EXECUTION_OWNER: "api_rollback",
    ...envPartial,
  } as Env;
  return new Hono().route("/internal/jobs", createInternalCronRoutes(minimalContainer(), env));
}

describe("absentee replay API delegation guard", () => {
  it("returns 409 when worker owns absentee replay", async () => {
    const app = appForEnv({ ABSENTEE_REPLAY_OWNER: "worker" });
    const res = await app.request("/internal/jobs/replay-absentee-for-lot", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: LOT_ID }),
    });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "absentee_replay_delegated_to_worker" });
  });

  it("allows replay under api_rollback owner", async () => {
    const container = minimalContainer();
    const env = {
      CRON_INTERNAL_SECRET: CRON_SECRET,
      LIFECYCLE_EXECUTION_OWNER: "api",
      ABSENTEE_REPLAY_OWNER: "api_rollback",
      FINANCE_CRON_EXECUTION_OWNER: "api_rollback",
    } as Env;
    const app = new Hono().route("/internal/jobs", createInternalCronRoutes(container, env));
    const res = await app.request("/internal/jobs/replay-absentee-for-lot", {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ lotId: LOT_ID }),
    });
    expect(res.status).toBe(200);
    expect(container.absenteeBidService.replayScheduledForLot).toHaveBeenCalledWith(LOT_ID);
  });
});
