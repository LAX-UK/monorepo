import type { QcReadyOutcome } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { shopOrder, shopOrderLine, shopProductionTask } from "@auction/db/schema";
import { type ShopProductionTaskStatus, canTransitionProductionTask } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type { ProductionTaskRepository } from "../application/ports/production-task.repository.js";
import type { QcReadyToPack } from "../application/ports/qc-ready-to-pack.js";
import { ShopApiError } from "../errors/shop-api-error.js";

/** The name the audit trail carries for a step Zoho's quality check made. */
export const ZOHO_QC_ACTOR = "system:zoho-qc";

/** The steps from where a task stands to quality check passed; absent where it cannot get there. */
const PATH: Partial<Record<ShopProductionTaskStatus, readonly ShopProductionTaskStatus[]>> = {
  printing: ["qc_pending", "qc_passed"],
  qc_pending: ["qc_passed"],
};

/**
 * Moves the print's production task through the same repository LAX Admin uses, so the version,
 * the legal-step rule, the open-frame gate and the audit row are the ones staff get. A task already
 * at or past the check is left alone, so a repeated notice changes nothing. Zoho is never
 * written to here, so nothing comes back to Zoho from this step.
 */
export function createDrizzleQcReadyToPack(
  db: Database,
  tasks: Pick<ProductionTaskRepository, "update">,
): QcReadyToPack {
  return {
    async markPassed(request): Promise<QcReadyOutcome> {
      const [row] = await db
        .select({
          reference: shopOrder.reference,
          printLineId: shopOrderLine.framingForLineId,
          lineId: shopOrderLine.id,
        })
        .from(shopOrderLine)
        .innerJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
        .where(eq(shopOrderLine.id, request.lineId))
        .limit(1);
      // The reference must match, so an id from another order is never acted on.
      if (!row || row.reference !== request.orderReference) return "unmatched";

      const [task] = await db
        .select()
        .from(shopProductionTask)
        .where(eq(shopProductionTask.orderLineId, row.printLineId ?? row.lineId))
        .limit(1);
      if (!task) return "unmatched";
      if (task.status === "qc_passed" || task.status === "completed") return "already";
      const steps = PATH[task.status];
      if (!steps) return "not_ready";

      let version = task.version;
      for (const to of steps) {
        let result: Awaited<ReturnType<typeof tasks.update>>;
        try {
          result = await tasks.update({
            id: task.id,
            expectedVersion: version,
            status: to,
            actorSubjectId: ZOHO_QC_ACTOR,
            canMove: canTransitionProductionTask,
          });
        } catch (error) {
          // The repository refuses a pass while a frame sold with the print is still open.
          if (error instanceof ShopApiError && error.statusCode === 409) return "frame_open";
          throw error;
        }
        // A concurrent change (a stale version, a task that moved) is retried by the worker.
        if (result.status !== "updated") throw new Error(`production task ${result.status}`);
        version = result.version;
      }
      return "moved";
    },
  };
}
