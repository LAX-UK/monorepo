import "server-only";

import {
  getAdminPurchaseProblem,
  getPurchaseProblemAssignees,
} from "@/lib/data/http/admin-purchase-problems.reader";
import type {
  PurchaseProblemAssignee,
  PurchaseProblemView,
} from "@/lib/data/http/admin-purchase-problems.schema";

export type PurchaseProblemPageModel =
  | { kind: "ready"; problem: PurchaseProblemView; assignees: PurchaseProblemAssignee[] }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** One report with the staff it can be handed to; the kind says why there is no record to show. */
export async function loadAdminPurchaseProblemPage(id: string): Promise<PurchaseProblemPageModel> {
  try {
    const [problem, assignees] = await Promise.all([
      getAdminPurchaseProblem(id),
      getPurchaseProblemAssignees(),
    ]);
    return problem ? { kind: "ready", problem, assignees } : { kind: "not_found" };
  } catch (error) {
    return {
      kind: error instanceof Error && error.message === "forbidden" ? "forbidden" : "unavailable",
    };
  }
}
