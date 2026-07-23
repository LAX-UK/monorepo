import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FINANCE_CRON_LOCAL_JOB_PATHS,
  assertWorkerFinanceHandlersAreLocal,
} from "@auction/background-runtime";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const handlersSource = readFileSync(join(here, "create-worker-finance-services.ts"), "utf8");

describe("finance cron local ownership", () => {
  it("lists every finance cron job path", () => {
    expect(FINANCE_CRON_LOCAL_JOB_PATHS.length).toBe(10);
  });

  it("worker finance handlers do not delegate to API rollback HTTP", () => {
    expect(() => assertWorkerFinanceHandlersAreLocal(handlersSource)).not.toThrow();
  });

  it("bulk settlement uses shared finance-runtime worker path", () => {
    expect(handlersSource).toContain("runWorkerBulkPayoutSettlement");
    expect(handlersSource).toContain("createWorkerPayoutSettlementContext");
    expect(handlersSource).not.toMatch(/bulk_payout_settlement_stub/);
  });
});
