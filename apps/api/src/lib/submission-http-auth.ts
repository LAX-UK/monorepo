import {
  type CapabilityRequirement,
  NO_STAFF_ROLES,
  SUBMISSIONS_ACCESS,
  SUBMISSIONS_READ_ACCESS,
  type StaffRoles,
  type UserRole,
  normalizeUserRoleOrClient,
  requirementCapabilities,
  userHasAccessTo,
} from "@auction/types";
import type { SubmissionHttpJson } from "../services/interfaces/submission-routes/submission-route-http.js";
import { missingCapabilityBody } from "./forbidden-response.js";

function deniedResponse(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
  requirement: CapabilityRequirement,
  message: string,
): SubmissionHttpJson {
  const normalizedRole = normalizeUserRoleOrClient(role) as UserRole;
  return {
    status: 403,
    body: missingCapabilityBody(message, requirementCapabilities(requirement), {
      role: normalizedRole,
      staffRoles: staffRoles ?? NO_STAFF_ROLES,
    }),
  };
}

export function submissionsAccessDeniedResponse(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
): SubmissionHttpJson {
  return deniedResponse(
    role,
    staffRoles,
    SUBMISSIONS_ACCESS,
    "Only staff with specialist.appraise, catalogue.write, or auction.manage can access submissions",
  );
}

export function hasSubmissionsAccess(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
): boolean {
  return userHasAccessTo(
    normalizeUserRoleOrClient(role) as UserRole,
    staffRoles,
    SUBMISSIONS_ACCESS,
  );
}

export function requireSubmissionsAccessHttp(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
): SubmissionHttpJson | null {
  if (hasSubmissionsAccess(role, staffRoles)) return null;
  return submissionsAccessDeniedResponse(role, staffRoles);
}

/** Reading submission lists: whoever works on submissions, or anyone holding `admin.read`. */
export function requireSubmissionsReadAccessHttp(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
): SubmissionHttpJson | null {
  const normalizedRole = normalizeUserRoleOrClient(role) as UserRole;
  if (userHasAccessTo(normalizedRole, staffRoles, SUBMISSIONS_READ_ACCESS)) return null;
  return deniedResponse(
    role,
    staffRoles,
    SUBMISSIONS_READ_ACCESS,
    "Only staff who work on submissions, or hold admin.read, can list submissions",
  );
}
