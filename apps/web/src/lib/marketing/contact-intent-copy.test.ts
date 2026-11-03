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

  it("gives a registration question its own headline, the sale and the buying topic", () => {
    const config = contactIntentFromSearchParams({
      intent: "registration",
      sale: "Prints & Multiples, November",
    });
    expect(config.topic).toBe("buying");
    expect(config.headline).toMatch(
      /^Ask about your registration for Prints & Multiples, November\./,
    );
    expect(config.messageTag).toBe("Registration enquiry: Prints & Multiples, November");
  });

  it("still frames a registration question when no sale is named", () => {
    const config = contactIntentFromSearchParams({ intent: "registration" });
    expect(config.topic).toBe("buying");
    expect(config.headline).toMatch(/^Ask about your registration\. Tell us which sale/);
    expect(config.messageTag).toBe("Registration enquiry");
  });

  it("keeps a long or untidy sale name to one short line", () => {
    const config = contactIntentFromSearchParams({
      intent: "registration",
      sale: `  ${"A".repeat(300)}\n\nsecond line `,
    });
    expect(config.messageTag?.length).toBeLessThan(160);
    expect(config.messageTag).not.toContain("\n");
  });

  it("leaves the general form untouched", () => {
    const config = contactIntentFromSearchParams({});
    expect(config.topicField).toBeNull();
    expect(config.messageTag).toBeNull();
    expect(config.submitLabel).toBe("Send message");
  });
});
