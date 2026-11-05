import {
  adminPurchaseProblemListQuerySchema,
  adminPurchaseProblemPatchSchema,
  purchaseProblemIdParamSchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { requirePurchaseProblems } from "../../middleware/require-capability.js";
import type { AdminEnquiryRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import type { PurchaseProblemUpdateError } from "../../services/interfaces/purchase-problem-desk-service.js";
import type { AdminHono } from "./_shared.js";

const UPDATE_ERROR_STATUS: Record<PurchaseProblemUpdateError, 404 | 409 | 422> = {
  purchase_problem_not_found: 404,
  stale_version: 409,
  assignee_invalid: 422,
  not_allowed: 422,
  resolution_note_required: 422,
  unchanged: 422,
};

/**
 * Problems buyers report with a paid purchase, for client services and administrators. The same
 * access reads and works them: the record is not read-only for anyone who can open it.
 */
export function attachAdminPurchaseProblemRoutes(
  platform: AdminHono,
  container: AdminEnquiryRoutesContainer,
): void {
  platform.use("/purchase-problems", requirePurchaseProblems);
  platform.use("/purchase-problems/*", requirePurchaseProblems);
  platform.use("/purchase-problem-assignees", requirePurchaseProblems);

  /** GET /admin/purchase-problems — one page of a status, with counts and filters. */
  platform.get(
    "/purchase-problems",
    zValidator("query", adminPurchaseProblemListQuerySchema),
    async (c) => {
      const data = await container.admin.purchaseProblems.list(c.req.valid("query"));
      return c.json({ data });
    },
  );

  /** GET /admin/purchase-problems/:id — what the buyer wrote, the purchase, notes. */
  platform.get(
    "/purchase-problems/:id",
    zValidator("param", purchaseProblemIdParamSchema),
    async (c) => {
      const data = await container.admin.purchaseProblems.detail(c.req.valid("param").id);
      if (!data) return c.json({ error: "purchase_problem_not_found" }, 404);
      return c.json({ data });
    },
  );

  /** PATCH /admin/purchase-problems/:id — assign, change status, resolve with a note, add a note. */
  platform.patch(
    "/purchase-problems/:id",
    zValidator("param", purchaseProblemIdParamSchema),
    zValidator("json", adminPurchaseProblemPatchSchema),
    async (c) => {
      const result = await container.admin.purchaseProblems.update(
        c.get("userId") as string,
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      if (result.ok) return c.json({ data: result.problem });
      return c.json(
        {
          error: result.error,
          ...(result.currentVersion !== undefined ? { currentVersion: result.currentVersion } : {}),
        },
        UPDATE_ERROR_STATUS[result.error],
      );
    },
  );

  /** GET /admin/purchase-problem-assignees — the staff a report may be given to, by name. */
  platform.get("/purchase-problem-assignees", async (c) => {
    return c.json({ data: { assignees: await container.admin.purchaseProblems.assignees() } });
  });
}
