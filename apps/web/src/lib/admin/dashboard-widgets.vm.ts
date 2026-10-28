import { getDashboardProfile } from "@/lib/admin/dashboard-profile-registry";
import type { StaffRoles } from "@auction/types";

export const ADMIN_DASHBOARD_WIDGETS_COOKIE = "lax_admin_dashboard_widgets";
export const ADMIN_DASHBOARD_WIDGETS_COOKIE_VERSION = 3 as const;

export type DashboardWidgetId =
  | "greeting"
  | "kpi-band"
  | "my-queue"
  | "saleroom-live"
  | "onsite-radar"
  | "activity";

export type DashboardWidgetState = {
  id: DashboardWidgetId;
  order: number;
  hidden: boolean;
};

type VersionedDashboardWidgetsCookie = {
  v: typeof ADMIN_DASHBOARD_WIDGETS_COOKIE_VERSION;
  widgets: Partial<DashboardWidgetState>[];
};

export const DEFAULT_DASHBOARD_WIDGETS: readonly DashboardWidgetState[] = [
  { id: "greeting", order: 0, hidden: false },
  { id: "kpi-band", order: 1, hidden: false },
  { id: "my-queue", order: 2, hidden: false },
  { id: "saleroom-live", order: 3, hidden: false },
  { id: "onsite-radar", order: 4, hidden: false },
  { id: "activity", order: 5, hidden: false },
] as const;

const SECONDARY_WIDGET_IDS = new Set<DashboardWidgetId>([
  "saleroom-live",
  "onsite-radar",
  "activity",
]);

function widgetsFromProfile(staffRoles: StaffRoles | undefined): DashboardWidgetState[] {
  const profile = getDashboardProfile(staffRoles);
  const secondary = new Set(profile.secondaryWidgets);
  return DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
    ...widget,
    hidden: SECONDARY_WIDGET_IDS.has(widget.id) ? !secondary.has(widget.id) : widget.hidden,
  }));
}

/** Role-specific first-visit layout when no saved cookie exists. */
export function defaultDashboardWidgetsForStaffRole(
  staffRoles: StaffRoles | undefined,
): readonly DashboardWidgetState[] {
  return widgetsFromProfile(staffRoles);
}

export function mergeDashboardWidgets(
  saved: readonly Partial<DashboardWidgetState>[] | null | undefined,
  staffRoles?: StaffRoles | undefined,
): DashboardWidgetState[] {
  const base = defaultDashboardWidgetsForStaffRole(staffRoles);
  const byId = new Map<DashboardWidgetId, DashboardWidgetState>();
  for (const def of base) {
    byId.set(def.id, { ...def });
  }
  for (const patch of saved ?? []) {
    if (!patch.id || !byId.has(patch.id)) continue;
    const current = byId.get(patch.id);
    if (!current) continue;
    byId.set(patch.id, {
      id: current.id,
      order: patch.order ?? current.order,
      hidden: patch.hidden ?? current.hidden,
    });
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

function parseLegacyCookieArray(raw: string): Partial<DashboardWidgetState>[] | null {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return null;
  return parsed as Partial<DashboardWidgetState>[];
}

function parseVersionedCookie(raw: string): Partial<DashboardWidgetState>[] | null {
  const parsed = JSON.parse(raw) as unknown;
  if (
    parsed != null &&
    typeof parsed === "object" &&
    "v" in parsed &&
    (parsed as VersionedDashboardWidgetsCookie).v === ADMIN_DASHBOARD_WIDGETS_COOKIE_VERSION &&
    Array.isArray((parsed as VersionedDashboardWidgetsCookie).widgets)
  ) {
    return (parsed as VersionedDashboardWidgetsCookie).widgets;
  }
  return null;
}

export function parseDashboardWidgetsCookie(
  raw: string | null | undefined,
  staffRoles?: StaffRoles | undefined,
): DashboardWidgetState[] {
  if (!raw?.trim()) return mergeDashboardWidgets(null, staffRoles);
  try {
    const versioned = parseVersionedCookie(raw);
    if (versioned) return mergeDashboardWidgets(versioned, staffRoles);
    const legacy = parseLegacyCookieArray(raw);
    if (legacy) return mergeDashboardWidgets(legacy, staffRoles);
    return mergeDashboardWidgets(null, staffRoles);
  } catch {
    return mergeDashboardWidgets(null, staffRoles);
  }
}

export function serializeDashboardWidgetsCookie(widgets: readonly DashboardWidgetState[]): string {
  const payload: VersionedDashboardWidgetsCookie = {
    v: ADMIN_DASHBOARD_WIDGETS_COOKIE_VERSION,
    widgets: widgets.map(({ id, order, hidden }) => ({ id, order, hidden })),
  };
  return JSON.stringify(payload);
}

export function isDashboardWidgetVisible(
  widgets: readonly DashboardWidgetState[],
  id: DashboardWidgetId,
): boolean {
  return !widgets.find((w) => w.id === id)?.hidden;
}
