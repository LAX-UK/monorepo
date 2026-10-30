import {
  ADMINISTRATOR_STAFF_ROLE,
  type CapabilityRequirement,
  type StaffRoles,
  type UserRole,
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  laxStaffRoleOption,
  staffRoleDefaultDestination,
  userHasAccessTo,
  userStaffRoles,
} from "@auction/types";

/**
 * The admin route groups and who may enter each, the same rules their layouts enforce:
 * `(platform)` pages, `(finance)` pages, and `(shared)` pages every staff member can open.
 */
export type AdminRouteArea = "platform" | "finance" | "shared";

const AREA_ACCESS: Record<
  AdminRouteArea,
  (role: UserRole, staffRoles: StaffRoles | undefined) => boolean
> = {
  platform: canAccessPlatformAdminRoutes,
  finance: canAccessFinanceAdminRoutes,
  shared: (role) => role === "staff",
};

/** Top-level admin sections outside `(platform)`, by the route group they live in. */
export const ADMIN_ROUTE_AREAS: Readonly<Record<string, Exclude<AdminRouteArea, "platform">>> = {
  payments: "finance",
  disputes: "finance",
  payouts: "finance",
  finance: "finance",
  integrations: "finance",
  audit: "shared",
  kit: "shared",
  "no-access": "shared",
};

/** The route group an admin path belongs to; anything not listed is a platform page. */
export function adminRouteArea(href: string): AdminRouteArea {
  const path = href.split(/[?#]/)[0] ?? href;
  const section = path.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
  return ADMIN_ROUTE_AREAS[section] ?? "platform";
}

/**
 * Whether this person can open an admin page: they may enter its route group and hold the
 * capability the page asks for. Navigation, the command palette and page guards all use this,
 * so nothing is offered that would then turn the person away.
 */
export function canOpenAdminRoute(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
  href: string,
  requirement?: CapabilityRequirement,
): boolean {
  if (!AREA_ACCESS[adminRouteArea(href)](role, staffRoles)) return false;
  return requirement === undefined || userHasAccessTo(role, staffRoles, requirement);
}

/** The Bid staff roles (other than administrator) that each alone can open a page, by display name. */
export function staffRolesThatCanOpen(href: string, requirement?: CapabilityRequirement): string[] {
  return userStaffRoles
    .filter((role) => role !== ADMINISTRATOR_STAFF_ROLE)
    .filter((role) => canOpenAdminRoute("staff", [role], href, requirement))
    .map((role) => laxStaffRoleOption("bid", role)?.label ?? role);
}

export const ADMIN_NO_ACCESS_PATH = "/admin/no-access";

/**
 * Where to send someone who cannot open `requestedPath`: the admin home is each role's own
 * overview, so asking for it goes there; any other page explains who can open it.
 */
export function adminDenialDestination(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
  requestedPath: string,
): string {
  const path = requestedPath.split(/[?#]/)[0] ?? requestedPath;
  const home = staffRoleDefaultDestination(role, staffRoles);
  // A role whose overview is the admin home itself has nowhere better to go than the explanation.
  if (path === "/admin" && home !== "/admin") return home;
  return `${ADMIN_NO_ACCESS_PATH}?from=${encodeURIComponent(requestedPath)}`;
}
