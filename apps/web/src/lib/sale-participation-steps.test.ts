import { describe, expect, it } from "vitest";
import {
  getOnlineTimelineStep2Description,
  getOnlineTimelineStep3Description,
  getOnsiteAbsenteePhoneStepDescription,
  getOnsitePaddleStepDescription,
  getOnsiteStreamStepDescription,
  getOnsiteTimelineStepTitle,
} from "./sale-participation-steps";
import { getParticipationStepCopy } from "./sale-type-presentation";

describe("sale-participation-steps", () => {
  it("online step 2 description matches presentation maxBids copy", () => {
    const text = getOnlineTimelineStep2Description();
    expect(text).toContain("auto-bid is enabled");
    expect(text).not.toContain("beforehand");
  });

  it("online step 3 description includes 30s anti-snipe when sale active", () => {
    const text = getOnlineTimelineStep3Description(false, new Date("2026-06-15T12:00:00Z"));
    expect(text).toContain("30 seconds");
    expect(text).toContain("catalogue closes on");
  });

  it("online step 3 returns concluded copy when sale ended", () => {
    expect(getOnlineTimelineStep3Description(true, new Date())).toBe("Auction has concluded.");
  });

  it("onsite absentee step combines presentation absentee and phone copy", () => {
    const text = getOnsiteAbsenteePhoneStepDescription();
    expect(text).toContain("request");
  });

  it("onsite stream step uses presentation when stream available", () => {
    const text = getOnsiteStreamStepDescription(true);
    expect(text).toMatch(/live stream is available/i);
  });

  it("onsite step 2 title and description align with attendLive presentation", () => {
    expect(getOnsiteTimelineStepTitle(2)).toBe("2. Secure a Paddle");
    const attendLive = getParticipationStepCopy("onsite", "attendLive");
    expect(getOnsitePaddleStepDescription()).toBe(attendLive?.description);
  });
});
