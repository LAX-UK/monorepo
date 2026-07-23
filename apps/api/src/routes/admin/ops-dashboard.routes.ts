import { zValidator } from "../../lib/z-validator.js";
import {
  requireAdminDashboard,
  requireLegalEntityBrowse,
  requireOnboardingQueues,
} from "../../middleware/require-capability.js";
import type { AdminOpsDashboardRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import {
  adminOnboardingIssuesQuerySchema,
  adminOnboardingIssuesSelectedQuerySchema,
} from "./_schemas.js";
import type { AdminHono } from "./_shared.js";

const requireLegalEntityRead = requireLegalEntityBrowse;

export function attachAdminOpsDashboardRoutes(
  platform: AdminHono,
  container: AdminOpsDashboardRoutesContainer,
): void {
  platform.get("/metrics/finance-issues", requireAdminDashboard, async (c) => {
    const data = await container.admin.financeIssueSnapshot.getFinanceIssueSnapshot();
    return c.json({ data });
  });

  /** Paginated onboarding / compliance queues (DSE20). */
  platform.get(
    "/onboarding-issues",
    requireOnboardingQueues,
    zValidator("query", adminOnboardingIssuesQuerySchema),
    async (c) => {
      const { tab, limit, offset } = c.req.valid("query");
      const page = await container.admin.onboardingIssues.getPage({
        tab,
        limit,
        offset,
      });
      return c.json({
        data: page.rows,
        meta: {
          tab: page.tab,
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          summary: page.summary,
          lensSummary: page.lensSummary,
        },
      });
    },
  );

  platform.get(
    "/onboarding-issues/selected",
    requireOnboardingQueues,
    zValidator("query", adminOnboardingIssuesSelectedQuerySchema),
    async (c) => {
      const { tab, id } = c.req.valid("query");
      const row = await container.admin.onboardingIssues.getSelectedItem({ tab, id });
      return c.json({ data: row });
    },
  );

  platform.get("/legal-entities/stripe-connect-requirements", requireLegalEntityRead, async (c) => {
    const rows = await container.admin.stripeConnectRequirements.listEntities();
    return c.json({ data: rows });
  });
}
