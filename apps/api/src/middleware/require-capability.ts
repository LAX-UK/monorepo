import {
  ADMIN_DASHBOARD_ACCESS,
  AML_REVIEW_ACCESS,
  ANALYTICS_ACCESS,
  ARTISTS_ACCESS,
  ARTIST_REVIEW_ACCESS,
  ARTIST_WRITE_ACCESS,
  AUDIT_DOMAIN_EVENTS_ACCESS,
  CATEGORIES_ACCESS,
  CLIENT_ACTIVITY_ACCESS,
  CLIENT_BIDS_ACCESS,
  CLIENT_KYC_ACCESS,
  type CapabilityRequirement,
  EMAIL_ADMIN_ACCESS,
  EMAIL_OBSERVABILITY_ACCESS,
  INVITATIONS_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  LOTS_ACCESS,
  MLRO_DECISION_ACCESS,
  ONBOARDING_QUEUES_ACCESS,
  PLATFORM_ADMIN_ACCESS,
  QR_CODES_ACCESS,
  type RoleCapability,
  SUBMISSIONS_ACCESS,
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  type UserRole,
  VENUES_ACCESS,
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
  userHasAccessTo,
} from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { LegalEntityContext } from "./require-legal-entity-context.js";
import type { RoleSource } from "./role-source.js";
import { honoContextRoleSource } from "./role-source.js";

export function createRequireAccess(
  requirement: CapabilityRequirement,
  src: RoleSource = honoContextRoleSource,
) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>(async (c, next) => {
    const role = src.getRole(c) as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!userHasAccessTo(role, staff, requirement)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

export function createRequireCapability(
  capability: RoleCapability,
  src: RoleSource = honoContextRoleSource,
) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>(async (c, next) => {
    const role = src.getRole(c) as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!roleHasCapability(role, capability, staff)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

/**
 * Platform admin **shell** gate: excludes finance_ops only.
 * Not the same as `platform.admin.full` — use `requirePlatformAdminFull` for that.
 */
export const requirePlatformShell = createMiddleware<{
  Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
}>(async (c, next) => {
  const role = normalizeUserRoleOrClient(c.get("userRole"));
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  if (!canAccessPlatformAdminRoutes(role, staff)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

export const requireFinanceAccess = createRequireCapability("finance.read");
export const requireUserInvite = createRequireCapability("user.invite");
export const requireArtistRead = createRequireCapability("artist.read");
export const requireArtistReview = createRequireCapability("artist.review");
export const requireArtistMerge = createRequireCapability("artist.merge");
export const requireArtistDelete = createRequireCapability("artist.delete");
export const requirePayoutRead = createRequireCapability("payout.read");
export const requirePayoutProcess = createRequireCapability("payout.process");
export const requirePayoutReverse = createRequireCapability("payout.reverse");
export const requireAuditReadPii = createRequireCapability("audit.read_pii");
export const requireOperationsFulfilment = createRequireCapability("operations.fulfilment");
export const requireCatalogueWrite = createRequireCapability("catalogue.write");
export const requireSpecialistAppraise = createRequireCapability("specialist.appraise");
export const requireAuctionManage = createRequireCapability("auction.manage");

export const requirePlatformAdminFull = createRequireAccess(PLATFORM_ADMIN_ACCESS);
export const requireUsersDirectory = createRequireAccess(USERS_DIRECTORY_ACCESS);
export const requireUserModeration = createRequireAccess(USER_MODERATION_ACCESS);
export const requireAnalytics = createRequireAccess(ANALYTICS_ACCESS);
export const requireOnboardingQueues = createRequireAccess(ONBOARDING_QUEUES_ACCESS);
export const requireAdminDashboard = createRequireAccess(ADMIN_DASHBOARD_ACCESS);
export const requireInvitationsAccess = createRequireAccess(INVITATIONS_ACCESS);
export const requireLegalEntityBrowse = createRequireAccess(LEGAL_ENTITY_BROWSE_ACCESS);
export const requireSubmissionsAccess = createRequireAccess(SUBMISSIONS_ACCESS);
export const requireQrCodesAccess = createRequireAccess(QR_CODES_ACCESS);
export const requireCategoriesAccess = createRequireAccess(CATEGORIES_ACCESS);
export const requireVenuesAccess = createRequireAccess(VENUES_ACCESS);
export const requireArtistsAccess = createRequireAccess(ARTISTS_ACCESS);
export const requireArtistWriteAccess = createRequireAccess(ARTIST_WRITE_ACCESS);
export const requireArtistReviewAccess = createRequireAccess(ARTIST_REVIEW_ACCESS);
export const requireLotsAccess = createRequireAccess(LOTS_ACCESS);
export const requireAuditDomainEvents = createRequireAccess(AUDIT_DOMAIN_EVENTS_ACCESS);
export const requireEmailAdmin = createRequireAccess(EMAIL_ADMIN_ACCESS);
export const requireEmailObservability = createRequireAccess(EMAIL_OBSERVABILITY_ACCESS);
export const requireClientBids = createRequireAccess(CLIENT_BIDS_ACCESS);
export const requireClientKyc = createRequireAccess(CLIENT_KYC_ACCESS);
export const requireClientActivity = createRequireAccess(CLIENT_ACTIVITY_ACCESS);
/** AML / sanctions watchlist queue + first-line analyst triage; SoF list/triage. */
export const requireAmlReview = createRequireAccess(AML_REVIEW_ACCESS);
/** Binding MLRO decision (checker) on a flagged screening / SoF case. */
export const requireMlroDecision = createRequireAccess(MLRO_DECISION_ACCESS);

/** Condition report queue: specialists, catalogue editors, or full auction managers. */
export const requireSpecialistCatalogueOrAuctionManage = createMiddleware<{
  Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
}>(async (c, next) => {
  const role = honoContextRoleSource.getRole(c) as UserRole;
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  if (
    roleHasCapability(role, "specialist.appraise", staff) ||
    roleHasCapability(role, "catalogue.write", staff) ||
    roleHasCapability(role, "auction.manage", staff)
  ) {
    await next();
    return;
  }
  return c.json({ error: "Forbidden" }, 403);
});

const ENTITY_FINANCE_WRITE_ROLES = new Set(["owner", "admin", "finance"]);

export const requireFinanceEntityWrite = createMiddleware<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRole?: string | null;
    legalEntityContext?: LegalEntityContext;
  };
}>(async (c, next) => {
  const role = c.get("userRole") as UserRole | undefined;
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  if (role && roleHasCapability(role, "finance.entity.write", staff)) {
    await next();
    return;
  }
  const ctx = c.get("legalEntityContext");
  if (ctx && ENTITY_FINANCE_WRITE_ROLES.has(ctx.role)) {
    await next();
    return;
  }
  return c.json({ error: "insufficient_entity_finance_role" }, 403);
});
