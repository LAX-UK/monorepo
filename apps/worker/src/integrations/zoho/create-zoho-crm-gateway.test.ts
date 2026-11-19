import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { ZohoCrmHttpError } from "./types.js";

const gatewayInstances: Array<{ queryCoql: ReturnType<typeof vi.fn> }> = [];

vi.mock("./zoho-crm-gateway.js", () => ({
  ZohoCrmGateway: class {
    queryCoql = vi.fn().mockRejectedValue(new ZohoCrmHttpError(429, "rate limited"));
    executeCoql = vi.fn().mockResolvedValue([]);
    getMetrics = () => ({ apiCreditsRemaining: null });
    constructor() {
      gatewayInstances.push(this);
    }
  },
}));

const {
  createZohoCoqlQuery,
  createZohoCrmBatchStack,
  createZohoCrmGateway,
  createZohoCrmGatewayWithCoql,
  zohoCrmGatewayLimiter,
} = await import("./create-zoho-crm-gateway.js");

function env(): WorkerEnv {
  return {
    ZOHO_CRM_API_HOST: "https://sandbox.zohoapis.eu",
    ZOHO_CRM_UPSERT_TRIGGER: "",
  } as WorkerEnv;
}

describe("Zoho CRM stacks share one limiter per process", () => {
  it("builds one limiter and one gateway however many stacks are created", () => {
    const processEnv = env();
    const before = gatewayInstances.length;
    const limiter = zohoCrmGatewayLimiter(processEnv);

    createZohoCrmGateway(processEnv);
    createZohoCrmGatewayWithCoql(processEnv);
    createZohoCrmGatewayWithCoql(processEnv);
    createZohoCrmBatchStack(processEnv);
    createZohoCoqlQuery(processEnv);

    expect(zohoCrmGatewayLimiter(processEnv)).toBe(limiter);
    expect(gatewayInstances.length - before).toBe(1);
  });

  it("opens one circuit for every stack: failures through one stack refuse calls through another", async () => {
    const processEnv = env();
    const listing = createZohoCrmBatchStack(processEnv);
    const status = createZohoCrmGatewayWithCoql(processEnv);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      for (let i = 0; i < 5; i++) {
        await expect(listing.queryCoql("select id from Products")).rejects.toBeDefined();
        await vi.advanceTimersByTimeAsync(150);
      }
      await expect(status.executeCoql("select id from Products")).rejects.toMatchObject({
        retryable: true,
      });
      const inner = gatewayInstances.at(-1);
      expect(inner?.queryCoql).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps separate limiters for separately parsed envs", () => {
    expect(zohoCrmGatewayLimiter(env())).not.toBe(zohoCrmGatewayLimiter(env()));
  });
});
