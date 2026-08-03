import { describe, expect, it } from "vitest";
import {
  ADMIN_DASHBOARD_WIDGETS_COOKIE_VERSION,
  parseDashboardWidgetsCookie,
  serializeDashboardWidgetsCookie,
} from "./dashboard-widgets.vm";

describe("dashboard-widgets.vm versioning", () => {
  it("serializes versioned cookie payloads", () => {
    const serialized = serializeDashboardWidgetsCookie([
      { id: "greeting", order: 0, hidden: false },
    ]);
    const parsed = JSON.parse(serialized) as { v: number; widgets: unknown[] };
    expect(parsed.v).toBe(ADMIN_DASHBOARD_WIDGETS_COOKIE_VERSION);
    expect(Array.isArray(parsed.widgets)).toBe(true);
  });

  it("accepts legacy array cookies", () => {
    const legacy = JSON.stringify([{ id: "activity", order: 0, hidden: false }]);
    const widgets = parseDashboardWidgetsCookie(legacy, "super_admin");
    expect(widgets.find((w) => w.id === "activity")?.hidden).toBe(false);
  });

  it("applies finance profile defaults when cookie is absent", () => {
    const widgets = parseDashboardWidgetsCookie(null, "finance_ops");
    expect(widgets.find((w) => w.id === "my-queue")?.hidden).toBe(false);
    expect(widgets.find((w) => w.id === "saleroom-live")?.hidden).toBe(true);
    expect(widgets.find((w) => w.id === "activity")?.hidden).toBe(true);
  });
});
