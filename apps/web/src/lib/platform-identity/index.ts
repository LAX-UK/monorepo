/**
 * Bounded platform-identity web surface. Prefer importing from here in app routes;
 * implementations remain under `../legal-entity/`.
 */

export {
  switchActingLegalEntity,
  dismissActingContextTooltip,
  endAdminImpersonationAction,
  startAdminImpersonation,
  startAdminImpersonationAfterLookup,
} from "../legal-entity/acting-context.actions.js";
export {
  resolveActingContext,
  getActingLegalEntityHeader,
  type ResolvedActingContext,
  type ResolvedActingImpersonation,
} from "../legal-entity/acting-context.server.js";
export {
  deriveActingContext,
  type DeriveActingContextResult,
} from "../legal-entity/derive-acting-context.js";
export {
  acceptInvitationByIdAction,
  declineInvitationByIdAction,
} from "../legal-entity/invitation.actions.js";
export {
  createPendingInvitationsGateway,
  type IPendingInvitationsGateway,
  type PendingInvitationRow,
} from "../legal-entity/pending-invitations.gateway.server.js";
export {
  checkOrgNameAction,
  createOrganizationAction,
  type CheckNameResult,
  type CreateOrganizationActionResult,
} from "../legal-entity/organization-onboarding.actions.js";
export {
  createPerOrgGateway,
  type IPerOrgGateway,
  type PerOrganisationContext,
  type OrgAccessResult,
} from "../legal-entity/per-org.gateway.server.js";
export { orgOnboardingResumeHref } from "../legal-entity/org-onboarding-resume.js";
export { isOrgModuleEnabled } from "../legal-entity/org-module-enabled.js";
