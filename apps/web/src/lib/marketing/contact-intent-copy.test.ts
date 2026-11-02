import { describe, expect, it } from "vitest";
import { contactIntentFromSearchParams } from "./contact-intent-copy.js";

describe("contactIntentFromSearchParams", () => {
  it("pre-selects press topic for intent=press", () => {
    const config = contactIntentFromSearchParams({ intent: "press" });
    expect(config.topic).toBe("press");
    expect(config.headline).toMatch(/Press & media enquiry/i);
    expect(config.successCtaHref).toBe("/press");
  });

  it("frames a purchase problem as a buying enquiry", () => {
    const config = contactIntentFromSearchParams({ intent: "purchase-problem" });
    expect(config.topic).toBe("buying");
    expect(config.headline).toMatch(/^Report a problem with a purchase/);
  });

  it("words a private sale enquiry as buy or sell, tagged for staff", () => {
    const config = contactIntentFromSearchParams({ intent: "private-sale" });
    expect(config.topicField?.options.map((o) => o.value)).toEqual(["buying", "selling"]);
    expect(config.messageTag).toBe("Private sale enquiry");
    expect(config.submitLabel).toBe("Send enquiry");
  });

  it("leaves the general form untouched", () => {
    const config = contactIntentFromSearchParams({});
    expect(config.topicField).toBeNull();
    expect(config.messageTag).toBeNull();
    expect(config.submitLabel).toBe("Send message");
  });
});
