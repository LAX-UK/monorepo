import { getDashboardProfile } from "@/lib/admin/dashboard-profile-registry";
import type { UserStaffRole } from "@auction/types";

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

function widgetsFromProfile(staffRole: UserStaffRole | null | undefined): DashboardWidgetState[] {
  const profile = getDashboardProfile(staffRole ?? null);
  const secondary = new Set(profile.secondaryWidgets);
  return DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
    ...widget,
    hidden: SECONDARY_WIDGET_IDS.has(widget.id) ? !secondary.has(widget.id) : widget.hidden,
  }));
}

/** Role-specific first-visit layout when no saved cookie exists. */
export function defaultDashboardWidgetsForStaffRole(
  staffRole: UserStaffRole | null | undefined,
): readonly DashboardWidgetState[] {
  return widgetsFromProfile(staffRole);
}

export function mergeDashboardWidgets(
  saved: readonly Partial<DashboardWidgetState>[] | null | undefined,
  staffRole?: UserStaffRole | null,
): DashboardWidgetState[] {
  const base = defaultDashboardWidgetsForStaffRole(staffRole);
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
  staffRole?: UserStaffRole | null,
): DashboardWidgetState[] {
  if (!raw?.trim()) return mergeDashboardWidgets(null, staffRole);
  try {
    const versioned = parseVersionedCookie(raw);
    if (versioned) return mergeDashboardWidgets(versioned, staffRole);
    const legacy = parseLegacyCookieArray(raw);
    if (legacy) return mergeDashboardWidgets(legacy, staffRole);
    return mergeDashboardWidgets(null, staffRole);
  } catch {
    return mergeDashboardWidgets(null, staffRole);
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
