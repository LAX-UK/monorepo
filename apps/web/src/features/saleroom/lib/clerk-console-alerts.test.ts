import { describe, expect, it } from "vitest";
import {
  buildClerkConsoleAlertDefinitions,
  partitionClerkConsoleAlerts,
} from "./clerk-console-alerts";

describe("buildClerkConsoleAlertDefinitions", () => {
  it("prioritizes destructive errors first", () => {
    const alerts = buildClerkConsoleAlertDefinitions({
      paddleRosterEmpty: true,
      pendingTelForLot: 2,
      selfServiceConflict: true,
      error: "Server failed",
      loadWarnings: ["Paddle roster could not be loaded."],
    });

    expect(alerts[0]?.key).toBe("error");
    expect(alerts[1]?.key).toBe("load-warning-0");
    expect(alerts.some((a) => a.key === "paddles")).toBe(true);
  });
});

describe("partitionClerkConsoleAlerts", () => {
  it("caps visible alerts unless expanded", () => {
    const alerts = [
      { key: "a", title: "A", body: "a", variant: "default" as const, priority: 1 },
      { key: "b", title: "B", body: "b", variant: "default" as const, priority: 2 },
      { key: "c", title: "C", body: "c", variant: "default" as const, priority: 3 },
    ];

    const capped = partitionClerkConsoleAlerts(alerts, false);
    expect(capped.visible).toHaveLength(2);
    expect(capped.hiddenCount).toBe(1);

    const expanded = partitionClerkConsoleAlerts(alerts, true);
    expect(expanded.visible).toHaveLength(3);
    expect(expanded.hiddenCount).toBe(0);
  });
});
