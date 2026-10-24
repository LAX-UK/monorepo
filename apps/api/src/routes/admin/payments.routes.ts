import { adminPaymentsListQuerySchema } from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireFinanceAccess,
  requirePaymentManualReviewWrite,
} from "../../middleware/require-capability.js";
import type { AdminPaymentsRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import { adminPaymentIdParamSchema } from "./_schemas.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminPaymentsListRoutes(
  finance: AdminHono,
  container: AdminPaymentsRoutesContainer,
): void {
  finance.get(
    "/payments",
    requireFinanceAccess,
    zValidator("query", adminPaymentsListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const page = await container.admin.payments.listPage({
        limit: q.limit,
        offset: q.offset,
        ...(q.status ? { status: q.status } : {}),
        ...(q.q ? { q: q.q } : {}),
      });
      return c.json({
        data: page.rows,
        meta: {
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          summary: page.summary,
        },
      });
    },
  );
}

export function attachAdminPaymentsManualReviewRoutes(
  finance: AdminHono,
  container: AdminPaymentsRoutesContainer,
): void {
  finance.get("/payments/manual-review", requireFinanceAccess, async (c) => {
    const data = await container.admin.manualReviewPayments.listManualReviewPayments();
    return c.json({ data });
  });

  finance.post(
    "/payments/:id/capture-and-process",
    requirePaymentManualReviewWrite,
    zValidator("param", adminPaymentIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "client";
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const result = await container.admin.payments.releaseManualReviewForCapture(
        userId,
        role,
        id,
        staffRole,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) =>
          c.json(
            { error: error.message, ...(error.code ? { code: error.code } : {}) },
            asHttpStatus(error.status),
          ),
      );
    },
  );

  finance.post(
    "/payments/:id/refund-buyer",
    requirePaymentManualReviewWrite,
    zValidator("param", adminPaymentIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "client";
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const result = await container.admin.payments.refundManualReviewPayment(
        userId,
        role,
        id,
        staffRole,
      );
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );
}
