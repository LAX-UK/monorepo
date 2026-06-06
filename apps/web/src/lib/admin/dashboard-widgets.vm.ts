import type { UserStaffRole } from "@auction/types";

export const ADMIN_DASHBOARD_WIDGETS_COOKIE = "lax_admin_dashboard_widgets";

export type DashboardWidgetId =
  | "greeting"
  | "kpi-band"
  | "my-queue"
  | "anomalies"
  | "saleroom-live"
  | "onsite-radar"
  | "activity";

export type DashboardWidgetState = {
  id: DashboardWidgetId;
  order: number;
  hidden: boolean;
};

export const DEFAULT_DASHBOARD_WIDGETS: readonly DashboardWidgetState[] = [
  { id: "greeting", order: 0, hidden: false },
  { id: "kpi-band", order: 1, hidden: false },
  { id: "my-queue", order: 2, hidden: false },
  { id: "anomalies", order: 3, hidden: false },
  { id: "saleroom-live", order: 4, hidden: false },
  { id: "onsite-radar", order: 5, hidden: false },
  { id: "activity", order: 6, hidden: false },
] as const;

/** Role-specific first-visit layout when no saved cookie exists. */
export const DEFAULT_DASHBOARD_WIDGETS_BY_STAFF_ROLE: Partial<
  Record<UserStaffRole, readonly DashboardWidgetState[]>
> = {
  super_admin: [
    { id: "greeting", order: 0, hidden: false },
    { id: "kpi-band", order: 1, hidden: false },
    { id: "my-queue", order: 2, hidden: false },
    { id: "anomalies", order: 3, hidden: false },
    { id: "saleroom-live", order: 4, hidden: true },
    { id: "onsite-radar", order: 5, hidden: true },
    { id: "activity", order: 6, hidden: true },
  ],
};

export function defaultDashboardWidgetsForStaffRole(
  staffRole: UserStaffRole | null | undefined,
): readonly DashboardWidgetState[] {
  if (staffRole == null) return DEFAULT_DASHBOARD_WIDGETS;
  return DEFAULT_DASHBOARD_WIDGETS_BY_STAFF_ROLE[staffRole] ?? DEFAULT_DASHBOARD_WIDGETS;
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

export function parseDashboardWidgetsCookie(
  raw: string | null | undefined,
  staffRole?: UserStaffRole | null,
): DashboardWidgetState[] {
  if (!raw?.trim()) return mergeDashboardWidgets(null, staffRole);
  try {
    const parsed = JSON.parse(raw) as Partial<DashboardWidgetState>[];
    if (!Array.isArray(parsed)) return mergeDashboardWidgets(null, staffRole);
    return mergeDashboardWidgets(parsed, staffRole);
  } catch {
    return mergeDashboardWidgets(null, staffRole);
  }
}

export function serializeDashboardWidgetsCookie(widgets: readonly DashboardWidgetState[]): string {
  return JSON.stringify(widgets);
}

export function isDashboardWidgetVisible(
  widgets: readonly DashboardWidgetState[],
  id: DashboardWidgetId,
): boolean {
  return !widgets.find((w) => w.id === id)?.hidden;
}
