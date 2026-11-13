import {
  ACCOUNTING_QUEUE_WRITE_ACCESS,
  type AccountingTryAgainRefusal,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import {
  adminAccountingDocumentIdParamSchema,
  adminAccountingQueueQuerySchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { requireAccountingQueueWrite } from "../../middleware/require-capability.js";
import type { AdminAccountingRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

const REFUSAL_STATUS: Readonly<Record<AccountingTryAgainRefusal, 404 | 409 | 422>> = {
  not_found: 404,
  not_allowed: 409,
  unreadable: 422,
};

/**
 * Finance › Accounting: the documents sent to the books for both companies (`finance.read`,
 * applied to every `/finance/*` route), and trying a refused one again (platform finance write and
 * an Idempotency-Key). A try again requeues the same document under the same LAX reference.
 */
export function attachAdminAccountingRoutes(
  finance: AdminHono,
  container: AdminAccountingRoutesContainer,
  guards: AdminStaffMutationGuards,
): void {
  finance.get(
    "/finance/accounting",
    zValidator("query", adminAccountingQueueQuerySchema),
    async (c) => {
      const { tab, organisation, limit, offset } = c.req.valid("query");
      const canAct = userHasAccessTo(
        c.get("userRole") as UserRole,
        c.get("userStaffRoles") as StaffRoles | undefined,
        ACCOUNTING_QUEUE_WRITE_ACCESS,
      );
      const page = await container.admin.accountingQueue.list({
        tab,
        organisation: organisation ?? null,
        limit,
        offset,
        canAct,
      });
      return c.json({ data: page });
    },
  );

  finance.post(
    "/finance/accounting/:id/try-again",
    requireAccountingQueueWrite,
    guards.idempotent("accounting.try-again"),
    zValidator("param", adminAccountingDocumentIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const answer = await container.admin.accountingQueue.tryAgain({
        documentId: id,
        actorUserId: c.get("userId") as string,
      });
      if (!answer.ok) {
        return c.json(
          { error: answer.message, code: answer.refusal },
          REFUSAL_STATUS[answer.refusal],
        );
      }
      return c.json({ data: answer.value });
    },
  );
}
