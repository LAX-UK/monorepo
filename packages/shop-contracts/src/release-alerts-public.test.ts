import { describe, expect, it } from "vitest";
import { parseReleaseAlertUnsubscribePreview } from "./release-alerts-public.js";

describe("release alert stop preview", () => {
  it("accepts a preview from a shop-api that does not send the topic yet", () => {
    expect(
      parseReleaseAlertUnsubscribePreview({ maskedEmail: "a•••@example.com", active: true }),
    ).toEqual({
      maskedEmail: "a•••@example.com",
      active: true,
    });
  });

  it("accepts a topic-scoped preview and an all-alerts preview", () => {
    expect(
      parseReleaseAlertUnsubscribePreview({
        maskedEmail: "a•••@example.com",
        active: true,
        topic: "back_in_stock",
      }).topic,
    ).toBe("back_in_stock");
    expect(
      parseReleaseAlertUnsubscribePreview({
        maskedEmail: "a•••@example.com",
        active: false,
        topic: null,
      }).topic,
    ).toBeNull();
  });

  it("rejects a topic it does not know", () => {
    expect(() =>
      parseReleaseAlertUnsubscribePreview({
        maskedEmail: "a•••@example.com",
        active: true,
        topic: "x",
      }),
    ).toThrow();
  });
});
