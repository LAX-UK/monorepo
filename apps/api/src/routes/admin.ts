import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireAuctionManage,
  requireFinanceAccess,
  requirePlatformShell,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { attachAdminInvitationRoutes } from "./admin-invitations.js";
import { attachAdminLegalEntityLifecycleRoutes } from "./admin-legal-entity-lifecycle.js";
import { attachAdminMarketingEventsRoutes } from "./admin-marketing-events.js";
import { createAdminOnsiteEventRoutes } from "./admin-onsite-events.js";
import { attachAdminQueuesRoutes } from "./admin-queues.js";
import { attachAdminStripeConnectRoutes } from "./admin-stripe-connect.routes.js";
import type { AdminHono } from "./admin/_shared.js";
import { attachAdminAuditRoutes } from "./admin/audit.routes.js";
import { attachAdminCatalogRoutes } from "./admin/catalog.routes.js";
import { attachAdminComplianceRoutes } from "./admin/compliance.routes.js";
import { attachAdminConditionReportsRoutes } from "./admin/condition-reports.routes.js";
import { attachAdminEmailRoutes } from "./admin/email.routes.js";
import { attachAdminFinanceRoutes } from "./admin/finance.routes.js";
import { attachAdminImpersonationRoutes } from "./admin/impersonation.routes.js";
import { attachAdminLotFulfilmentRoutes } from "./admin/lot-fulfilment.routes.js";
import { attachAdminLotsCatalogRoutes } from "./admin/lots-catalog.routes.js";
import { attachAdminLotsRoutes } from "./admin/lots.routes.js";
import { attachAdminOpsDashboardRoutes } from "./admin/ops-dashboard.routes.js";
import { attachAdminAttentionRoutes, attachAdminOpsRoutes } from "./admin/ops.routes.js";
import {
  attachAdminPaymentsListRoutes,
  attachAdminPaymentsManualReviewRoutes,
} from "./admin/payments.routes.js";
import { attachAdminQrCodesRoutes } from "./admin/qr-codes.routes.js";
import { attachAdminSaleRegistrationsRoutes } from "./admin/sale-registrations.routes.js";
import { attachAdminSaleroomSessionRoutes } from "./admin/saleroom-session.routes.js";
import { attachAdminSaleroomRoutes } from "./admin/saleroom.routes.js";
import {
  attachAdminUsersDirectoryRoutes,
  attachAdminUsersManagementRoutes,
} from "./admin/users.routes.js";
import { createAdminTelephoneBookingRoutes } from "./telephone-bookings.js";

export function createAdminRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.admin.requestLifecycle.isSuspended(id),
  });

  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();
  r.use("*", requireAuth);

  const platform: AdminHono = new Hono();
  platform.use("*", requirePlatformShell);
  platform.use(
    "*",
    createMiddleware<{
      Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
    }>(async (c, next) => {
      await container.admin.requestLifecycle.reconcileAdminRequestCookie({
        actorUserId: c.get("userId") as string,
        cookieHeader: c.req.header("Cookie"),
      });
      await next();
    }),
  );

  attachAdminOpsRoutes(platform, container);
  attachAdminPaymentsListRoutes(platform, container);
  attachAdminQrCodesRoutes(platform, container);
  attachAdminOpsDashboardRoutes(platform, container);
  attachAdminConditionReportsRoutes(platform, container);
  attachAdminSaleRegistrationsRoutes(platform, container);
  attachAdminSaleroomRoutes(platform, container);

  // Hono merges a sub-app's handlers into the parent router, so `subApp.use("*", mw)`
  // registered after the sub-app's routes never guards them and instead gates every
  // platform route registered after the mount. Guards must be path-scoped and
  // registered before the routes they protect.
  platform.use("/telephone-bookings", requireAuctionManage);
  platform.use("/telephone-bookings/*", requireAuctionManage);
  platform.use("/sales/:saleId/telephone-bookings", requireAuctionManage);
  platform.use("/sales/:saleId/telephone-bookings/*", requireAuctionManage);
  platform.route("/", createAdminTelephoneBookingRoutes(container));

  platform.use("/event-rsvps", requireAuctionManage);
  platform.use("/event-rsvps/*", requireAuctionManage);
  platform.route("/event-rsvps", createAdminOnsiteEventRoutes(container));

  attachAdminSaleroomSessionRoutes(platform, container);
  attachAdminLotFulfilmentRoutes(platform, container);
  attachAdminLotsCatalogRoutes(platform, container);
  attachAdminPaymentsManualReviewRoutes(platform, container);
  attachAdminAttentionRoutes(platform, container);
  attachAdminLotsRoutes(platform, container);
  attachAdminAuditRoutes(platform, container);
  attachAdminCatalogRoutes(platform, container);
  attachAdminEmailRoutes(platform, container);
  attachAdminUsersDirectoryRoutes(platform, container);
  attachAdminComplianceRoutes(platform, container);
  attachAdminUsersManagementRoutes(platform, container);
  attachAdminImpersonationRoutes(platform, container);

  attachAdminLegalEntityLifecycleRoutes(platform, container.admin.legalEntityLifecycle);

  if (container.admin.stripeConnect) {
    attachAdminStripeConnectRoutes(
      platform,
      container.admin.stripeConnect,
      container.admin.stripeConnect.webOrigin,
    );
  }

  attachAdminInvitationRoutes(platform, container.admin.invitations);

  attachAdminMarketingEventsRoutes(platform, container);

  attachAdminQueuesRoutes(platform, container);

  // Finance-shell routes must stay reachable for finance_ops, who fails
  // `requirePlatformShell`. Guards are path-scoped (not `use("*")`) so they don't
  // leak onto platform paths once this sub-app is merged into the parent router.
  const finance: AdminHono = new Hono();
  finance.use("/finance/*", requireFinanceAccess);
  finance.use("/payments/:id/xero-sync", requireFinanceAccess);
  finance.use("/integrations/xero/*", requireFinanceAccess);

  attachAdminFinanceRoutes(finance, container);

  // Mount finance first: its routes terminate the chain before platform's
  // `use("*", requirePlatformShell)` wildcard can 403 finance_ops.
  r.route("/", finance);
  r.route("/", platform);

  return r;
}
