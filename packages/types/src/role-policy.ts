export type { RoleCapability } from "./role-policy/role-capabilities.js";
export {
  canAccessStaffAdminShell,
  effectiveCapabilities,
  isKnownUserRole,
  normalizeUserRole,
  normalizeUserRoleOrClient,
  roleHasCapability,
} from "./role-policy/role-capabilities.js";
export {
  STAFF_CAPABILITIES,
  staffRoleCapabilities,
  staffRolesGranting,
} from "./role-policy/staff-capability-matrix.js";
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
  activeRolesOf,
  activeStaffRoles,
  isStaffRoleAssignmentActive,
  isStaffRoleAssignmentCurrent,
  staffRoleAssignmentEndsWithin,
  staffRoleAssignmentsOverlap,
} from "./role-policy/staff-role-assignment.js";
export {
  type StaffRoleRuleTable,
  type StaffRoleRules,
  createStaffRoleRules,
} from "./role-policy/staff-role-rule-engine.js";
export {
  FORBIDDEN_LAX_ADMIN_ROLE_COMBINATIONS,
  LAX_ADMIN_ADMINISTRATOR_ROLE,
  LAX_ADMIN_ROLE_RULES,
  activeLaxAdminRoles,
  isLaxAdminRole,
  laxAdminRolesFromGrants,
  normalizeLaxAdminRoles,
  primaryLaxAdminRole,
} from "./role-policy/lax-admin-role-rules.js";
export {
  ADMINISTRATOR_STAFF_ROLE,
  BID_STAFF_ROLE_RULES,
  FORBIDDEN_STAFF_ROLE_COMBINATIONS,
  type ForbiddenStaffRoleCombination,
  type StaffRoleAssignmentCheck,
  type StaffRoleAssignmentRefusal,
  type StaffRoleChange,
  type StaffRoleSetCheck,
  type StaffRosterFacts,
  checkStaffRoleAssignment,
  checkStaffRoleSet,
  forbiddenStaffRoleCombination,
  isForbiddenStaffRoleCombination,
} from "./role-policy/staff-role-assignment-rules.js";
export type { AppShellLayout, CapabilityRequirement } from "./role-policy/role-route-policy.js";
export {
  canAccessAdminSubmissionNotesWrite,
  canAccessAdminSubmissionsRead,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  requirementCapabilities,
  staffRoleDefaultDestination,
  staffRoleToShellLayout,
  userHasAccessTo,
} from "./role-policy/role-route-policy.js";
