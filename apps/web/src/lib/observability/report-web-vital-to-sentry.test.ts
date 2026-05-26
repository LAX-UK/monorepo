import { describe, expect, it, vi } from "vitest";
import { type WebVitalMetric, reportWebVitalToSentry } from "./report-web-vital-to-sentry";

describe("reportWebVitalToSentry", () => {
  it("records a distribution metric when Sentry metrics is available", () => {
    const distribution = vi.fn();
    const metric = {
      id: "v1",
      name: "FCP",
      value: 1200,
      rating: "good",
      delta: 1200,
      navigationType: "navigate",
    } as WebVitalMetric;

    reportWebVitalToSentry(metric, { distribution });

    expect(distribution).toHaveBeenCalledWith("web_vitals.FCP", 1200, {
      unit: "millisecond",
      attributes: { rating: "good", navigationType: "navigate" },
    });
  });

  it("records CLS without a duration unit", () => {
    const distribution = vi.fn();
    reportWebVitalToSentry(
      {
        name: "CLS",
        value: 0.05,
        rating: "good",
        navigationType: "navigate",
      },
      { distribution },
    );

    expect(distribution).toHaveBeenCalledWith("web_vitals.CLS", 0.05, {
      attributes: { rating: "good", navigationType: "navigate" },
    });
  });

  it("no-ops when metrics API is unavailable", () => {
    const distribution = vi.fn();
    reportWebVitalToSentry(
      {
        id: "v1",
        name: "LCP",
        value: 900,
        rating: "good",
        delta: 900,
        navigationType: "navigate",
      } as WebVitalMetric,
      undefined,
    );
    expect(distribution).not.toHaveBeenCalled();
  });
});
