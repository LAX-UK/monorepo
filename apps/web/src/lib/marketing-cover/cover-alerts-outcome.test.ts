import { describe, expect, it } from "vitest";
import {
  COVER_ALERTS_MESSAGE,
  COVER_ALERTS_OUTCOMES,
  parseAlertSignupSource,
  parseCoverAlertsOutcome,
} from "./cover-alerts-outcome";

describe("cover alerts outcome", () => {
  it("accepts only the known outcomes", () => {
    for (const outcome of COVER_ALERTS_OUTCOMES) {
      expect(parseCoverAlertsOutcome(outcome)).toBe(outcome);
    }
    expect(parseCoverAlertsOutcome("subscribed")).toBeNull();
    expect(parseCoverAlertsOutcome(undefined)).toBeNull();
  });

  it("has a message for every outcome; only a submitted sign-up is a success", () => {
    for (const outcome of COVER_ALERTS_OUTCOMES) {
      expect(COVER_ALERTS_MESSAGE[outcome].title).not.toBe("");
    }
    expect(COVER_ALERTS_MESSAGE.submitted).toMatchObject({
      tone: "success",
      title: "Check your email",
    });
    expect(COVER_ALERTS_MESSAGE.invalid.tone).toBe("danger");
  });

  it("falls back to the cover as the source of an unknown form", () => {
    expect(parseAlertSignupSource("web_home_alerts")).toBe("web_home_alerts");
    expect(parseAlertSignupSource("anything else")).toBe("web_home_cover");
    expect(parseAlertSignupSource(null)).toBe("web_home_cover");
  });
});
