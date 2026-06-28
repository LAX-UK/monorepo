import { describe, expect, it } from "vitest";
import { contactIntentFromSearchParams } from "./contact-intent-copy.js";

describe("contactIntentFromSearchParams", () => {
  it("pre-selects press topic for intent=press", () => {
    const config = contactIntentFromSearchParams({ intent: "press" });
    expect(config.topic).toBe("press");
    expect(config.headline).toMatch(/Press & media enquiry/i);
    expect(config.successCtaHref).toBe("/press");
  });
});
