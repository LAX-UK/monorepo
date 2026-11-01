import {
  CONSIGNMENT_INBOX_READ_ACCESS,
  CONSIGNMENT_INBOX_REPLY_ACCESS,
  CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS,
  type CapabilityRequirement,
  NO_STAFF_ROLES,
  type StaffRoles,
  type UserRole,
  normalizeUserRoleOrClient,
  requirementCapabilities,
  userHasAccessTo,
} from "@auction/types";
import type { SubmissionHttpJson } from "../services/interfaces/submission-routes/submission-route-http.js";
import { missingCapabilityBody } from "./forbidden-response.js";

function requireAccessHttp(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
  requirement: CapabilityRequirement,
  message: string,
): SubmissionHttpJson | null {
  const normalizedRole = normalizeUserRoleOrClient(role) as UserRole;
  if (userHasAccessTo(normalizedRole, staffRoles, requirement)) return null;
  return {
    status: 403,
    body: missingCapabilityBody(message, requirementCapabilities(requirement), {
      role: normalizedRole,
      staffRoles: staffRoles ?? NO_STAFF_ROLES,
    }),
  };
}

/** Reading the inbox and its threads. */
export function requireConsignmentInboxReadHttp(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
): SubmissionHttpJson | null {
  return requireAccessHttp(
    role,
    staffRoles,
    CONSIGNMENT_INBOX_READ_ACCESS,
    "Only staff who work with consignments can read client messages",
  );
}

/** Answering, assigning, closing and every other change to a thread. */
export function requireConsignmentInboxReplyHttp(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
): SubmissionHttpJson | null {
  return requireAccessHttp(
    role,
    staffRoles,
    CONSIGNMENT_INBOX_REPLY_ACCESS,
    "Only staff who answer clients can change consignment messages",
  );
}

/** Writing and retiring the team's saved replies. */
export function requireSavedRepliesManageHttp(
  role: string | null | undefined,
  staffRoles: StaffRoles | undefined,
): SubmissionHttpJson | null {
  return requireAccessHttp(
    role,
    staffRoles,
    CONSIGNMENT_SAVED_REPLIES_MANAGE_ACCESS,
    "Only sales managers and administrators can change saved replies",
  );
}
