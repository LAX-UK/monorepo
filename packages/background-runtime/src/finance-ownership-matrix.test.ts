import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FINANCE_CRON_LOCAL_JOB_PATHS,
  assertWorkerFinanceHandlersAreLocal,
  listFinanceCronBackgroundOperationIds,
} from "./finance-ownership-matrix.js";
import { BACKGROUND_OPERATION_REGISTRY } from "./registry.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const workerFinanceCronSource = readFileSync(
  join(repoRoot, "apps/worker/src/finance/create-worker-finance-cron.ts"),
  "utf8",
);

describe("finance local ownership matrix", () => {
  it("registers every local finance cron path on a worker-owned operation", () => {
    const financeOps = BACKGROUND_OPERATION_REGISTRY.filter((op) => op.kind === "finance_cron");
    const paths = new Set(
      financeOps.flatMap((op) => (op.internalJobPath ? [op.internalJobPath] : [])),
    );
    for (const path of FINANCE_CRON_LOCAL_JOB_PATHS) {
      expect(paths.has(path), `missing registry entry for ${path}`).toBe(true);
    }
    expect(listFinanceCronBackgroundOperationIds().length).toBeGreaterThan(0);
  });

  it("worker finance cron handlers do not use API rollback delegation", () => {
    expect(() => assertWorkerFinanceHandlersAreLocal(workerFinanceCronSource)).not.toThrow();
  });
});
