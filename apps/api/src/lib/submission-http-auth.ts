import {
  SUBMISSIONS_ACCESS,
  type UserRole,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  userHasAccessTo,
} from "@auction/types";
import type { SubmissionHttpJson } from "../services/interfaces/submission-routes/submission-route-http.js";
import { missingCapabilityBody } from "./forbidden-response.js";

export function submissionsAccessDeniedResponse(
  role: string | null | undefined,
  staffRole: string | null | undefined,
): SubmissionHttpJson {
  const normalizedRole = normalizeUserRoleOrClient(role) as UserRole;
  const staff = normalizeUserStaffRole(staffRole ?? undefined);
  const required =
    typeof SUBMISSIONS_ACCESS === "string" ? [SUBMISSIONS_ACCESS] : [...SUBMISSIONS_ACCESS.anyOf];
  return {
    status: 403,
    body: missingCapabilityBody(
      "Only staff with specialist.appraise, catalogue.write, or auction.manage can access submissions",
      required,
      { role: normalizedRole, staffRole: staff },
    ),
  };
}

export function hasSubmissionsAccess(
  role: string | null | undefined,
  staffRole: string | null | undefined,
): boolean {
  const normalizedRole = normalizeUserRoleOrClient(role) as UserRole;
  const staff = normalizeUserStaffRole(staffRole ?? undefined);
  return userHasAccessTo(normalizedRole, staff, SUBMISSIONS_ACCESS);
}

export function requireSubmissionsAccessHttp(
  role: string | null | undefined,
  staffRole: string | null | undefined,
): SubmissionHttpJson | null {
  if (hasSubmissionsAccess(role, staffRole)) return null;
  return submissionsAccessDeniedResponse(role, staffRole);
}
