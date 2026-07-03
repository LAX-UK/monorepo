import type { ContainerAdminRoutesSlice } from "../../container.js";
import {
  requireAdminDashboard,
  requireLegalEntityBrowse,
  requireOnboardingQueues,
} from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

const requireLegalEntityRead = requireLegalEntityBrowse;

export function attachAdminOpsDashboardRoutes(
  platform: AdminHono,
  container: ContainerAdminRoutesSlice,
): void {
  platform.get("/metrics/finance-issues", requireAdminDashboard, async (c) => {
    const data = await container.admin.dashboard.getFinanceIssueSnapshot();
    return c.json({ data });
  });

  /** Lists for onboarding / compliance queues (DSE20). */
  platform.get("/onboarding-issues", requireOnboardingQueues, async (c) => {
    const data = await container.admin.dashboard.getOnboardingIssues();
    return c.json({ data });
  });

  platform.get("/legal-entities/stripe-connect-requirements", requireLegalEntityRead, async (c) => {
    const rows = await container.admin.dashboard.listStripeConnectRequirementEntities();
    return c.json({ data: rows });
  });
}
