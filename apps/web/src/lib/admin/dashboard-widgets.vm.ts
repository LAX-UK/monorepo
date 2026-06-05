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

export function mergeDashboardWidgets(
  saved: readonly Partial<DashboardWidgetState>[] | null | undefined,
): DashboardWidgetState[] {
  const byId = new Map<DashboardWidgetId, DashboardWidgetState>();
  for (const def of DEFAULT_DASHBOARD_WIDGETS) {
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
): DashboardWidgetState[] {
  if (!raw?.trim()) return mergeDashboardWidgets(null);
  try {
    const parsed = JSON.parse(raw) as Partial<DashboardWidgetState>[];
    if (!Array.isArray(parsed)) return mergeDashboardWidgets(null);
    return mergeDashboardWidgets(parsed);
  } catch {
    return mergeDashboardWidgets(null);
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
