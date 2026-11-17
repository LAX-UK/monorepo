import { describe, expect, it } from "vitest";
import { releaseAlertMetricStrip, releaseAlertMetrics } from "./release-alert-metrics";

describe("releaseAlertMetrics", () => {
  it("shows who is emailed and who has yet to confirm, with thousands separated", () => {
    expect(releaseAlertMetrics({ confirmed: 1280, awaitingConfirmation: 14 })).toEqual([
      expect.objectContaining({ label: "Release alert subscribers", value: "1,280" }),
      expect.objectContaining({ label: "Awaiting confirmation", value: "14" }),
    ]);
  });

  it("shows a zero as a number, never a blank", () => {
    const [subscribers, waiting] = releaseAlertMetrics({ confirmed: 0, awaitingConfirmation: 0 });
    expect(subscribers?.value).toBe("0");
    expect(waiting?.value).toBe("0");
  });
});

describe("releaseAlertMetricStrip", () => {
  it("puts the figures above the list with their label and period", () => {
    expect(releaseAlertMetricStrip({ confirmed: 412, awaitingConfirmation: 9 })).toEqual({
      metrics: {
        label: "Release alerts",
        period: "People who asked to hear about new editions",
        items: releaseAlertMetrics({ confirmed: 412, awaitingConfirmation: 9 }),
      },
    });
  });

  it("shows no strip when the figures could not be read", () => {
    expect(releaseAlertMetricStrip(null)).toEqual({});
  });
});
