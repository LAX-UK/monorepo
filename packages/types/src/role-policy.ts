export type { RoleCapability } from "./role-policy/role-capabilities.js";
export {
  canAccessStaffAdminShell,
  effectiveCapabilities,
  isKnownUserRole,
  normalizeUserRole,
  normalizeUserRoleOrClient,
  roleHasCapability,
} from "./role-policy/role-capabilities.js";
export { staffRoleCapabilities } from "./role-policy/staff-capability-matrix.js";
export {
  effectivePermissions,
  staffRolesCapabilities,
} from "./role-policy/effective-permissions.js";
export {
  NO_STAFF_ROLES,
  type StaffRoles,
  hasStaffRole,
  holdsOnlyStaffRole,
  normalizeStaffRoles,
  primaryStaffRole,
} from "./role-policy/staff-roles.js";
export {
  type StaffRoleAssignment,
  activeStaffRoles,
  isStaffRoleAssignmentActive,
  isStaffRoleAssignmentCurrent,
  staffRoleAssignmentsOverlap,
} from "./role-policy/staff-role-assignment.js";
export {
  ADMINISTRATOR_STAFF_ROLE,
  FORBIDDEN_STAFF_ROLE_COMBINATIONS,
  type ForbiddenStaffRoleCombination,
  type StaffRoleAssignmentCheck,
  type StaffRoleAssignmentRefusal,
  type StaffRoleChange,
  type StaffRosterFacts,
  checkStaffRoleAssignment,
  isForbiddenStaffRoleCombination,
} from "./role-policy/staff-role-assignment-rules.js";
export type { AppShellLayout, CapabilityRequirement } from "./role-policy/role-route-policy.js";
export {
  canAccessAdminSubmissionNotesWrite,
  canAccessAdminSubmissionsRead,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  staffRoleDefaultDestination,
  staffRoleToShellLayout,
  userHasAccessTo,
} from "./role-policy/role-route-policy.js";
