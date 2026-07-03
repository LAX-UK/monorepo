export type { RoleCapability } from "./role-policy/role-capabilities.js";
export {
  canAccessStaffAdminShell,
  isKnownUserRole,
  normalizeUserRole,
  normalizeUserRoleOrClient,
  roleHasCapability,
} from "./role-policy/role-capabilities.js";
export { staffRoleHasCapability } from "./role-policy/staff-capability-matrix.js";
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
