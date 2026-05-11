import type { Database } from "@auction/db";
import type { Env } from "../../env.js";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { AdminUserService } from "../admin-user.service.js";
import type { ArtistProfileService } from "../artist-profile.service.js";
import type { CategoryService } from "../category.service.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ImpersonationAuditService } from "../impersonation-audit.service.js";
import type { ImpersonationSessionService } from "../impersonation-session.service.js";
import type { AdminRouteServices } from "../interfaces/admin-routes.js";
import type { IAnalyticsService } from "../interfaces/analytics.js";
import type { IAttentionFeedReader } from "../interfaces/attention-feed.js";
import type { IEmailObservabilityRepository } from "../interfaces/email-observability.js";
import type { IItemSubmissionService } from "../interfaces/item-submission-service.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.js";
import type { InvitationService } from "../invitation.service.js";
import type { LegalEntityLifecycleAdminService } from "../legal-entity-lifecycle-admin.service.js";
import type { LotService } from "../lot.service.js";
import type { PaymentService } from "../payment.service.js";
import type { XeroOAuthService } from "../xero-oauth.service.js";
import { AdminCatalogApplicationService } from "./admin-catalog-application.service.js";
import { AdminDashboardQueryService } from "./admin-dashboard-query.service.js";
import { AdminDomainEventQueryService } from "./admin-domain-event-query.service.js";
import { AdminEmailApplicationService } from "./admin-email-application.service.js";
import { AdminImpersonationService } from "./admin-impersonation.service.js";
import { AdminInvitationApplicationService } from "./admin-invitation-application.service.js";
import { AdminLegalEntityLifecycleApplicationService } from "./admin-legal-entity-lifecycle-application.service.js";
import { AdminLotsApplicationService } from "./admin-lots-application.service.js";
import { AdminOpsReadApplicationService } from "./admin-ops-read-application.service.js";
import { AdminPaymentsApplicationService } from "./admin-payments-application.service.js";
import { AdminRequestLifecycleApplicationService } from "./admin-request-lifecycle-application.service.js";
import { AdminUserApplicationService } from "./admin-user-application.service.js";
import { AdminXeroApplicationService } from "./admin-xero-application.service.js";

export type CreateAdminRouteServicesInput = {
  db: Database;
  domainEventPublisher: DomainEventPublisher;
  impersonationSessionService: ImpersonationSessionService;
  impersonationAuditService: ImpersonationAuditService;
  userSuspensionChecker: IUserSuspensionChecker;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  categoryService: CategoryService;
  artistProfileService: ArtistProfileService;
  emailObservabilityRepository: IEmailObservabilityRepository;
  adminUserService: AdminUserService;
  analyticsService: IAnalyticsService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  itemSubmissionService: IItemSubmissionService;
  paymentService: PaymentService;
  lotService: LotService;
  invitationService: InvitationService;
  xeroOAuthService: XeroOAuthService | null;
  env: Pick<Env, "XERO_REDIRECT_URI">;
};

export function createAdminRouteServices(input: CreateAdminRouteServicesInput): AdminRouteServices {
  return {
    requestLifecycle: new AdminRequestLifecycleApplicationService(
      input.impersonationAuditService,
      input.userSuspensionChecker,
    ),
    ops: new AdminOpsReadApplicationService(
      input.analyticsService,
      input.adminMetricsService,
      input.attentionFeedReader,
      input.itemSubmissionService,
    ),
    impersonation: new AdminImpersonationService(
      input.db,
      input.legalEntityRepository,
      input.impersonationSessionService,
      input.domainEventPublisher,
    ),
    domainEvents: new AdminDomainEventQueryService(input.db),
    dashboard: new AdminDashboardQueryService(input.db),
    catalog: new AdminCatalogApplicationService(input.categoryService, input.artistProfileService),
    email: new AdminEmailApplicationService(input.emailObservabilityRepository),
    users: new AdminUserApplicationService(input.adminUserService),
    payments: new AdminPaymentsApplicationService(input.paymentService),
    lots: new AdminLotsApplicationService(input.lotService),
    invitations: new AdminInvitationApplicationService(input.invitationService),
    legalEntityLifecycle: new AdminLegalEntityLifecycleApplicationService(
      input.legalEntityRepository,
      input.legalEntityLifecycleAdminService,
    ),
    xero: new AdminXeroApplicationService(input.xeroOAuthService, input.env.XERO_REDIRECT_URI),
  };
}
