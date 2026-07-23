import {
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  adminFinanceDisputeDomainEventsQuerySchema,
  adminFinanceDisputesQuerySchema,
  paymentIdParamSchema,
} from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import type { AdminFinanceShellRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import { attachXeroAdminRoutes } from "../xero-admin.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminFinanceRoutes(
  finance: AdminHono,
  container: AdminFinanceShellRoutesContainer,
): void {
  /** GET /admin/finance/dispute-domain-events — `payment.dispute*` only (finance-shell-safe). */
  finance.get(
    "/finance/dispute-domain-events",
    zValidator("query", adminFinanceDisputeDomainEventsQuerySchema),
    async (c) => {
      const { limit, offset } = c.req.valid("query");
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const includePii =
        c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii", staff);
      const data = await container.admin.domainEvents.listRedacted({
        limit,
        offset,
        eventTypePrefix: "payment.dispute",
        includePii,
      });
      return c.json({ data });
    },
  );

  /** GET /admin/finance/disputes — folded Stripe dispute cases for finance admin UI. */
  finance.get(
    "/finance/disputes",
    zValidator("query", adminFinanceDisputesQuerySchema),
    async (c) => {
      const { limit, offset, status } = c.req.valid("query");
      const result = await container.admin.disputeCases.listCases({
        limit,
        offset,
        ...(status !== undefined ? { status } : {}),
      });
      return c.json({
        data: result.rows,
        hasNextPage: result.hasNextPage,
        summary: result.summary,
      });
    },
  );

  /** GET /admin/finance/disputes/open-count — nav badge + anomaly counts. */
  finance.get("/finance/disputes/open-count", async (c) => {
    const count = await container.admin.disputeCases.countOpenCases();
    return c.json({ data: { count } });
  });

  finance.post("/payments/:id/xero-sync", zValidator("param", paymentIdParamSchema), async (c) => {
    const role = c.get("userRole") ?? "client";
    const staffRole = c.get("userStaffRole") ?? null;
    const { id } = c.req.valid("param");
    const result = await container.admin.payments.syncPaymentFromXeroAsAdmin(role, id, staffRole);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  attachXeroAdminRoutes(finance, container.admin);
}
