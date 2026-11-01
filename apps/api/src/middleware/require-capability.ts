import { entityActorCan } from "@auction/domain";
import {
  ADMIN_DASHBOARD_ACCESS,
  AML_REVIEW_ACCESS,
  ARTISTS_ACCESS,
  ARTIST_REVIEW_ACCESS,
  ARTIST_WRITE_ACCESS,
  AUDIT_DOMAIN_EVENTS_ACCESS,
  CATEGORIES_ACCESS,
  CATEGORIES_READ_ACCESS,
  CLIENT_ACTIVITY_ACCESS,
  CLIENT_BIDS_ACCESS,
  CLIENT_KYC_ACCESS,
  CONDITION_REPORTS_ACCESS,
  CONDITION_REPORTS_READ_ACCESS,
  CONSIGNMENT_INBOX_READ_ACCESS,
  CONSIGNMENT_INBOX_REPLY_ACCESS,
  CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS,
  type CapabilityRequirement,
  DELIVERY_REPLAY_ACCESS,
  DISPUTE_ALLOCATION_WRITE_ACCESS,
  EMAIL_ADMIN_ACCESS,
  EMAIL_OBSERVABILITY_ACCESS,
  INVITATIONS_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  LOTS_ACCESS,
  LOTS_READ_ACCESS,
  LOT_WORK_ACCESS,
  LOT_WORK_READ_ACCESS,
  MLRO_DECISION_ACCESS,
  ONBOARDING_QUEUES_ACCESS,
  PAYMENT_MANUAL_REVIEW_WRITE_ACCESS,
  PAYMENT_WRITE_ACCESS,
  PLATFORM_ADMIN_ACCESS,
  QR_CODES_ACCESS,
  QR_CODES_READ_ACCESS,
  type RoleCapability,
  SALEROOM_ACCESS,
  SALES_ACCESS,
  SALES_READ_ACCESS,
  STAFF_ACCESS_REVIEW_ACCESS,
  STAFF_ROLES_READ_ACCESS,
  SUBMISSIONS_ACCESS,
  SUBMISSIONS_READ_ACCESS,
  type StaffRoles,
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  type UserRole,
  VENUES_ACCESS,
  VENUES_READ_ACCESS,
  WITHDRAWAL_DECISION_ACCESS,
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
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
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>(async (c, next) => {
    const role = src.getRole(c) as UserRole;
    const staff = c.get("userStaffRoles");
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
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>(async (c, next) => {
    const role = src.getRole(c) as UserRole;
    const staff = c.get("userStaffRoles");
    if (!roleHasCapability(role, capability, staff)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

/**
 * Platform admin **shell** gate: excludes someone who holds only the finance role.
 * Not the same as `platform.admin.full` — use `requirePlatformAdminFull` for that.
 */
export const requirePlatformShell = createMiddleware<{
  Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
}>(async (c, next) => {
  const role = normalizeUserRoleOrClient(c.get("userRole"));
  const staff = c.get("userStaffRoles");
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

/** Rules shared with the admin web UI, so a button is shown exactly when the route will accept it. */
export const requireSalesAccess = createRequireAccess(SALES_ACCESS);
export const requireSalesRead = createRequireAccess(SALES_READ_ACCESS);
export const requireWithdrawalDecision = createRequireAccess(WITHDRAWAL_DECISION_ACCESS);
export const requireDeliveryReplay = createRequireAccess(DELIVERY_REPLAY_ACCESS);
export const requirePaymentManualReviewWrite = createRequireAccess(
  PAYMENT_MANUAL_REVIEW_WRITE_ACCESS,
);

export const requireDisputeAllocationWrite = createRequireAccess(DISPUTE_ALLOCATION_WRITE_ACCESS);

export const requirePlatformAdminFull = createRequireAccess(PLATFORM_ADMIN_ACCESS);
export const requireUsersDirectory = createRequireAccess(USERS_DIRECTORY_ACCESS);
export const requireUserModeration = createRequireAccess(USER_MODERATION_ACCESS);
export const requireStaffRolesRead = createRequireAccess(STAFF_ROLES_READ_ACCESS);
export const requireStaffAccessReview = createRequireAccess(STAFF_ACCESS_REVIEW_ACCESS);
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

/** Condition report queue requirement shared with web navigation and actions. */
export const requireConditionReportsAccess = createRequireAccess(CONDITION_REPORTS_ACCESS);

/** Shared document/catalogue route requirement retained for non-condition-report routes. */
export const requireSpecialistCatalogueOrAuctionManage = createRequireAccess(LOT_WORK_ACCESS);

/** The live saleroom and its actions: `auction.manage` or `saleroom.operate`. */
export const requireSaleroomOperate = createRequireAccess(SALEROOM_ACCESS);

/**
 * Read rules for list and record pages: whoever may change the records, or anyone holding
 * `admin.read`. Mount them on GET routes only; every action keeps its write rule.
 */
export const requireLotsRead = createRequireAccess(LOTS_READ_ACCESS);
export const requireLotWorkRead = createRequireAccess(LOT_WORK_READ_ACCESS);
export const requireSubmissionsRead = createRequireAccess(SUBMISSIONS_READ_ACCESS);
export const requireConsignmentInboxRead = createRequireAccess(CONSIGNMENT_INBOX_READ_ACCESS);
export const requireConsignmentInboxReply = createRequireAccess(CONSIGNMENT_INBOX_REPLY_ACCESS);
export const requireSavedRepliesManage = createRequireAccess(
  CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS,
);
export const requireCategoriesRead = createRequireAccess(CATEGORIES_READ_ACCESS);
export const requireConditionReportsRead = createRequireAccess(CONDITION_REPORTS_READ_ACCESS);
export const requireQrCodesRead = createRequireAccess(QR_CODES_READ_ACCESS);

/** Reads (GET, HEAD) use `read`; every other method uses `write`. For path-wide guards. */
export function createRequireAccessByMethod(
  rules: { read: CapabilityRequirement; write: CapabilityRequirement },
  src: RoleSource = honoContextRoleSource,
) {
  const read = createRequireAccess(rules.read, src);
  const write = createRequireAccess(rules.write, src);
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>(async (c, next) => {
    const isRead = c.req.method === "GET" || c.req.method === "HEAD";
    return (isRead ? read : write)(c, next);
  });
}

export const requireVenuesAccessByMethod = createRequireAccessByMethod({
  read: VENUES_READ_ACCESS,
  write: VENUES_ACCESS,
});

export const requireFinanceEntityWrite = createMiddleware<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRoles?: StaffRoles | undefined;
    legalEntityContext?: LegalEntityContext;
  };
}>(async (c, next) => {
  const role = c.get("userRole") as UserRole | undefined;
  const staff = c.get("userStaffRoles");
  if (role && userHasAccessTo(role, staff, PAYMENT_WRITE_ACCESS)) {
    await next();
    return;
  }
  const ctx = c.get("legalEntityContext");
  if (ctx && entityActorCan(ctx, "entity.finance.write")) {
    await next();
    return;
  }
  return c.json({ error: "insufficient_entity_finance_role" }, 403);
});
