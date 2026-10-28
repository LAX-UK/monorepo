import type {
  StaffProfileRoles,
  StaffRoleAssignmentRecord,
  StaffRosterEvent,
} from "@auction/persistence/interfaces";
import { type UserRole, activeStaffRoles, primaryStaffRole } from "@auction/types";

/** The roles the Bid profile should show, given the person's assignments at `now`. */
export function profileRolesFor(
  platformRole: UserRole,
  assignments: readonly StaffRoleAssignmentRecord[],
  now: Date,
): StaffProfileRoles {
  return {
    role: platformRole,
    primaryStaffRole:
      platformRole === "staff" ? primaryStaffRole(activeStaffRoles(assignments, now)) : null,
  };
}

/** The role the access history shows for a profile: the primary role, "staff", or none. */
function shownRole(roles: StaffProfileRoles | null): string | null {
  return roles?.role === "staff" ? (roles.primaryStaffRole ?? "staff") : null;
}

/**
 * The access-history event for a change of the shown role, or null when it did not change.
 * `actorUserId` is who made the change (the person themself when the system did).
 */
export function staffAccessHistoryEvent(
  previous: StaffProfileRoles | null,
  next: StaffProfileRoles,
  change: { userId: string; actorUserId: string; invitationId: string | null },
): StaffRosterEvent | null {
  const before = shownRole(previous);
  const after = shownRole(next);
  if (before === after) return null;
  return after === null
    ? {
        type: "lax.staff_access.revoked",
        payload: {
          schemaVersion: 1,
          subjectId: change.userId,
          product: "bid",
          revokedBySubjectId: change.actorUserId,
        },
      }
    : {
        type: "lax.staff_access.granted",
        payload: {
          schemaVersion: 1,
          subjectId: change.userId,
          product: "bid",
          role: after,
          grantedBySubjectId: change.actorUserId,
          invitationId: change.invitationId,
        },
      };
}
