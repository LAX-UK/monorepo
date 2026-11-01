import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { ContainerAdminPlatformRoutesSlice } from "../container.js";
import { createAdminIdempotency } from "../middleware/admin-idempotency.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireFinanceAccess,
  requirePlatformShell,
  requireSaleroomOperate,
} from "../middleware/require-capability.js";
import { createRequireRecentStaffAuth } from "../middleware/require-recent-staff-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { attachAdminInvitationRoutes } from "./admin-invitations.js";
import { attachAdminLegalEntityLifecycleRoutes } from "./admin-legal-entity-lifecycle.js";
import { attachAdminMarketingEventsRoutes } from "./admin-marketing-events.js";
import { createAdminOnsiteEventRoutes } from "./admin-onsite-events.js";
import { attachAdminQueuesRoutes } from "./admin-queues.js";
import { attachAdminStripeConnectRoutes } from "./admin-stripe-connect.routes.js";
import type { AdminHono, AdminStaffMutationGuards } from "./admin/_shared.js";
import { attachAdminAtgRoutes } from "./admin/atg.routes.js";
import { attachAdminAuditRoutes } from "./admin/audit.routes.js";
import { attachAdminCatalogRoutes } from "./admin/catalog.routes.js";
import { attachAdminComplianceRoutes } from "./admin/compliance.routes.js";
import { attachAdminConditionReportsRoutes } from "./admin/condition-reports.routes.js";
import { attachAdminDeliveryOpsRoutes } from "./admin/delivery-ops.routes.js";
import { attachAdminEmailRoutes } from "./admin/email.routes.js";
import { attachAdminFinanceRoutes } from "./admin/finance.routes.js";
import { attachAdminImpersonationRoutes } from "./admin/impersonation.routes.js";
import { attachAdminLegalEntityBuyerAgentRoutes } from "./admin/legal-entity-buyer-agents.routes.js";
import { attachAdminLotFulfilmentRoutes } from "./admin/lot-fulfilment.routes.js";
import { attachAdminLotsCatalogRoutes } from "./admin/lots-catalog.routes.js";
import { attachAdminLotsRoutes } from "./admin/lots.routes.js";
import {
  attachAdminFinanceIssueRoutes,
  attachAdminOpsDashboardRoutes,
} from "./admin/ops-dashboard.routes.js";
import { attachAdminAttentionRoutes, attachAdminOpsRoutes } from "./admin/ops.routes.js";
import {
  attachAdminPaymentsListRoutes,
  attachAdminPaymentsManualReviewRoutes,
} from "./admin/payments.routes.js";
import { attachAdminQrCodesRoutes } from "./admin/qr-codes.routes.js";
import { attachAdminSaleCoverRoutes } from "./admin/sale-cover.routes.js";
import { attachAdminSaleRegistrationsRoutes } from "./admin/sale-registrations.routes.js";
import { attachAdminSaleroomSessionRoutes } from "./admin/saleroom-session.routes.js";
import { attachAdminSaleroomRoutes } from "./admin/saleroom.routes.js";
import { attachAdminSavedViewRoutes } from "./admin/saved-views.routes.js";
import { attachAdminSecurityRoutes } from "./admin/security.routes.js";
import { attachAdminStaffAccessRoutes } from "./admin/staff-access.routes.js";
import {
  attachAdminLaxAdminRolesRoutes,
  attachAdminStaffRolesRoutes,
} from "./admin/staff-roles.routes.js";
import { attachAdminTwoFactorResetRoutes } from "./admin/two-factor-reset.routes.js";
import {
  attachAdminUsersDirectoryRoutes,
  attachAdminUsersManagementRoutes,
} from "./admin/users.routes.js";
import { createAdminTelephoneBookingRoutes } from "./telephone-bookings/index.js";

export function createAdminRoutes(
  container: ContainerAdminPlatformRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.admin.requestLifecycle.isSuspended(id),
  });

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  r.use("*", requireAuth);

  const guards: AdminStaffMutationGuards = {
    requireStepUp: createRequireRecentStaffAuth(container.admin.stepUp),
    idempotent: (scope) => createAdminIdempotency(container.admin.idempotencyStore, scope),
  };

  const platform: AdminHono = new Hono();
  platform.use("*", requirePlatformShell);
  platform.use(
    "*",
    createMiddleware<{
      Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
    }>(async (c, next) => {
      await container.admin.requestLifecycle.reconcileAdminRequestCookie({
        actorUserId: c.get("userId") as string,
        cookieHeader: c.req.header("Cookie"),
      });
      await next();
    }),
  );

  attachAdminOpsRoutes(platform, container);
  attachAdminQrCodesRoutes(platform, container);
  attachAdminOpsDashboardRoutes(platform, container);
  attachAdminConditionReportsRoutes(platform, container);
  attachAdminSaleRegistrationsRoutes(platform, container);
  attachAdminSaleCoverRoutes(platform, container.admin.saleCover);
  attachAdminSaleroomRoutes(platform, container);

  // Hono merges a sub-app's handlers into the parent router, so `subApp.use("*", mw)`
  // registered after the sub-app's routes never guards them and instead gates every
  // platform route registered after the mount. Guards must be path-scoped and
  // registered before the routes they protect.
  platform.use("/telephone-bookings", requireSaleroomOperate);
  platform.use("/telephone-bookings/*", requireSaleroomOperate);
  platform.use("/sales/:saleId/telephone-bookings", requireSaleroomOperate);
  platform.use("/sales/:saleId/telephone-bookings/*", requireSaleroomOperate);
  platform.route("/", createAdminTelephoneBookingRoutes(container));

  platform.use("/event-rsvps", requireSaleroomOperate);
  platform.use("/event-rsvps/*", requireSaleroomOperate);
  platform.route("/event-rsvps", createAdminOnsiteEventRoutes(container));

  attachAdminSaleroomSessionRoutes(platform, container);
  attachAdminLotFulfilmentRoutes(platform, container);
  attachAdminLotsCatalogRoutes(platform, container);
  attachAdminAttentionRoutes(platform, container);
  attachAdminLotsRoutes(platform, container, guards);
  attachAdminAuditRoutes(platform, container);
  attachAdminCatalogRoutes(platform, container);
  attachAdminEmailRoutes(platform, container);
  attachAdminUsersDirectoryRoutes(platform, container, guards);
  attachAdminComplianceRoutes(platform, container);
  attachAdminUsersManagementRoutes(platform, container, guards);
  attachAdminImpersonationRoutes(platform, container, guards);
  attachAdminSecurityRoutes(platform, container.admin.staffTwoFactorPolicy);
  attachAdminStaffAccessRoutes(platform, container.admin.staffAccess);
  attachAdminStaffRolesRoutes(platform, container.admin.staffRoles, guards);
  attachAdminLaxAdminRolesRoutes(platform, container.admin.laxAdminRoles, guards);
  attachAdminTwoFactorResetRoutes(platform, container.admin.twoFactorReset, guards);
  attachAdminSavedViewRoutes(platform, container.admin.savedViews);

  attachAdminLegalEntityLifecycleRoutes(platform, container.admin.legalEntityLifecycle, guards);
  attachAdminLegalEntityBuyerAgentRoutes(platform, container.admin.buyerAgentAuthorisations);

  if (container.admin.stripeConnect) {
    attachAdminStripeConnectRoutes(platform, container.admin.stripeConnect);
  }

  attachAdminAtgRoutes(platform, container.admin.atg);

  attachAdminInvitationRoutes(platform, container.admin.invitations);

  attachAdminMarketingEventsRoutes(platform, container);

  attachAdminQueuesRoutes(platform, container);

  attachAdminDeliveryOpsRoutes(platform, container);

  // Finance-shell routes must stay reachable for finance, who fails
  // `requirePlatformShell`. Guards are path-scoped (not `use("*")`) so they don't
  // leak onto platform paths once this sub-app is merged into the parent router.
  const finance: AdminHono = new Hono();
  finance.use("/finance/*", requireFinanceAccess);
  finance.use("/metrics/finance-issues", requireFinanceAccess);
  finance.use("/payments/:id/xero-sync", requireFinanceAccess);
  finance.use("/integrations/xero/*", requireFinanceAccess);

  // Payments are a finance screen: finance fails the platform shell, so these mount here.
  // Each route carries its own capability guard.
  attachAdminPaymentsListRoutes(finance, container);
  attachAdminPaymentsManualReviewRoutes(finance, container, guards);
  attachAdminFinanceIssueRoutes(finance, container);
  attachAdminFinanceRoutes(finance, container);

  // Mount finance first: its routes terminate the chain before platform's
  // `use("*", requirePlatformShell)` wildcard can 403 finance.
  r.route("/", finance);
  r.route("/", platform);

  return r;
}
