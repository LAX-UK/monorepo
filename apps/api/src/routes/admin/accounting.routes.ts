import {
  ACCOUNTING_QUEUE_WRITE_ACCESS,
  type AccountingReleaseRefusal,
  type AccountingTryAgainRefusal,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import {
  adminAccountingDocumentIdParamSchema,
  adminAccountingQueueQuerySchema,
} from "@auction/validators";
import type { MiddlewareHandler } from "hono";
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
 * `Cache-Control: no-store` on every Accounting response (it carries account names, which for an
 * individual buyer are a person's). Set after the rest of the chain has run, so a refusal (403,
 * 400, 404, 409) is never cached either. Mounted before the `/finance/*` gate
 * (`attachAdminAccountingNoStore`), so the gate's own refusal carries it too.
 */
const noStore: MiddlewareHandler = async (c, next) => {
  await next();
  c.res.headers.set("Cache-Control", "no-store");
};

/** Register before any other `/finance/*` middleware: see `noStore`. */
export function attachAdminAccountingNoStore(finance: AdminHono): void {
  finance.use("/finance/accounting", noStore);
  finance.use("/finance/accounting/*", noStore);
}

const RELEASE_REFUSAL_STATUS: Readonly<Record<AccountingReleaseRefusal, 404 | 409 | 422>> = {
  not_found: 404,
  not_allowed: 409,
  unresolved: 409,
  unreadable: 422,
};

/**
 * Finance › Accounting: the documents sent to the books for both companies (`finance.read`,
 * applied to every `/finance/*` route), trying a refused one again and releasing a parked one
 * whose reason is settled (each needs the platform finance write and an Idempotency-Key). Both
 * queue the same document under the same LAX reference.
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
      const { tab, organisation, reference, limit, offset } = c.req.valid("query");
      const canAct = userHasAccessTo(
        c.get("userRole") as UserRole,
        c.get("userStaffRoles") as StaffRoles | undefined,
        ACCOUNTING_QUEUE_WRITE_ACCESS,
      );
      const page = await container.admin.accountingQueue.list({
        tab,
        organisation: organisation ?? null,
        reference: reference ?? null,
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

  finance.post(
    "/finance/accounting/:id/release",
    requireAccountingQueueWrite,
    guards.idempotent("accounting.release"),
    zValidator("param", adminAccountingDocumentIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const answer = await container.admin.accountingQueue.release({
        documentId: id,
        actorUserId: c.get("userId") as string,
      });
      if (!answer.ok) {
        return c.json(
          { error: answer.message, code: answer.refusal },
          RELEASE_REFUSAL_STATUS[answer.refusal],
        );
      }
      return c.json({ data: answer.value });
    },
  );
}
