import type { DashboardWidgetId, DashboardWidgetState } from "@/lib/admin/dashboard-widgets.vm";
import {
  AML_REVIEW_ACCESS,
  type CapabilityRequirement,
  FINANCE_ACCESS,
  LOTS_ACCESS,
  LOT_FULFILMENT_ACCESS,
  SALEROOM_ACCESS,
  SALE_CATALOG_ACCESS,
  SUBMISSIONS_ACCESS,
  USERS_DIRECTORY_ACCESS,
  type UserRole,
  type UserStaffRole,
  userHasAccessTo,
} from "@auction/types";

/**
 * Capability requirement per dashboard widget. `null` means the widget is available
 * to all staff roles. The my-queue widget uses per-row filtering, so it's null here.
 */
export const DASHBOARD_WIDGET_REQUIREMENTS: Record<
  DashboardWidgetId,
  CapabilityRequirement | null
> = {
  greeting: null,
  "kpi-band": null,
  "my-queue": null,
  "saleroom-live": SALEROOM_ACCESS,
  "onsite-radar": SALEROOM_ACCESS,
  activity: LOTS_ACCESS,
};

/**
 * Filter a widget list to only those the viewer can access.
 * Used both for rendering and for the customize sheet (so users can't re-enable
 * widgets they can't use).
 */
export function allowedDashboardWidgets(
  role: UserRole,
  staffRole: UserStaffRole | null,
  widgets: readonly DashboardWidgetState[],
): DashboardWidgetState[] {
  return widgets.filter((w) => {
    const req = DASHBOARD_WIDGET_REQUIREMENTS[w.id];
    if (req === null) return true;
    return userHasAccessTo(role, staffRole, req);
  });
}

/**
 * Check if a specific widget is allowed for the given role.
 */
export function isWidgetAllowed(
  role: UserRole,
  staffRole: UserStaffRole | null,
  widgetId: DashboardWidgetId,
): boolean {
  const req = DASHBOARD_WIDGET_REQUIREMENTS[widgetId];
  if (req === null) return true;
  return userHasAccessTo(role, staffRole, req);
}

export type HubQuickLinkSpec = {
  href: string;
  label: string;
  requirement: CapabilityRequirement;
};

/**
 * All possible hub quick links with their capability requirements.
 * Order matters for display.
 */
export const HUB_QUICK_LINK_SPECS: readonly HubQuickLinkSpec[] = [
  { href: "/admin/finance", label: "Finance", requirement: FINANCE_ACCESS },
  { href: "/admin/sales", label: "Catalog", requirement: SALE_CATALOG_ACCESS },
  { href: "/admin/compliance/aml", label: "Compliance", requirement: AML_REVIEW_ACCESS },
  { href: "/admin/clients", label: "Clients", requirement: USERS_DIRECTORY_ACCESS },
  { href: "/admin/lot-fulfilment", label: "Fulfilment", requirement: LOT_FULFILMENT_ACCESS },
  { href: "/admin/submissions", label: "Submissions", requirement: SUBMISSIONS_ACCESS },
];

export type HubQuickLink = {
  href: string;
  label: string;
};

/**
 * Get the hub quick links that the viewer can access.
 */
export function hubQuickLinksFor(role: UserRole, staffRole: UserStaffRole | null): HubQuickLink[] {
  return HUB_QUICK_LINK_SPECS.filter((spec) =>
    userHasAccessTo(role, staffRole, spec.requirement),
  ).map(({ href, label }) => ({ href, label }));
}

/**
 * Check if the viewer can access a specific capability requirement.
 * Convenience wrapper for dashboard page orchestration.
 */
export function canAccess(
  role: UserRole,
  staffRole: UserStaffRole | null,
  requirement: CapabilityRequirement,
): boolean {
  return userHasAccessTo(role, staffRole, requirement);
}

export type DashboardQuickAction = {
  href: string;
  label: string;
  requirement: CapabilityRequirement | null;
};

export const DASHBOARD_GREETING_ACTIONS: readonly DashboardQuickAction[] = [
  { href: "/admin/lots/new", label: "New lot", requirement: LOTS_ACCESS },
  { href: "/admin/submissions", label: "Submissions", requirement: SUBMISSIONS_ACCESS },
];

export function greetingActionsFor(
  role: UserRole,
  staffRole: UserStaffRole | null,
): DashboardQuickAction[] {
  return DASHBOARD_GREETING_ACTIONS.filter(
    (action) => action.requirement == null || userHasAccessTo(role, staffRole, action.requirement),
  );
}
