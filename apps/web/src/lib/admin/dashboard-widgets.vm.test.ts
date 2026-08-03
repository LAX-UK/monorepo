import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_WIDGETS,
  mergeDashboardWidgets,
  parseDashboardWidgetsCookie,
} from "./dashboard-widgets.vm";

describe("dashboard-widgets.vm", () => {
  it("merges saved order and visibility with defaults", () => {
    const merged = mergeDashboardWidgets([
      { id: "activity", order: 0, hidden: false },
      { id: "greeting", order: 1, hidden: true },
    ]);
    expect(merged[0]?.id).toBe("activity");
    expect(merged.find((w) => w.id === "greeting")?.hidden).toBe(true);
    expect(merged.length).toBe(DEFAULT_DASHBOARD_WIDGETS.length);
  });

  it("returns defaults for invalid cookie", () => {
    const widgets = parseDashboardWidgetsCookie("not-json");
    expect(widgets.length).toBe(DEFAULT_DASHBOARD_WIDGETS.length);
    expect(widgets.find((w) => w.id === "greeting")?.hidden).toBe(false);
    expect(widgets.find((w) => w.id === "my-queue")?.hidden).toBe(false);
  });

  it("applies super_admin role defaults when cookie is absent", () => {
    const widgets = parseDashboardWidgetsCookie(null, "super_admin");
    expect(widgets.find((w) => w.id === "saleroom-live")?.hidden).toBe(true);
    expect(widgets.find((w) => w.id === "onsite-radar")?.hidden).toBe(true);
    expect(widgets.find((w) => w.id === "activity")?.hidden).toBe(false);
    expect(widgets.find((w) => w.id === "my-queue")?.hidden).toBe(false);
  });
});
