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
    expect(widgets.every((w) => !w.hidden)).toBe(true);
  });
});
