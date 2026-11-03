import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_LABELS, describeEmailTemplate } from "./template-labels.js";
import { templateNames } from "./types.js";

describe("email template labels", () => {
  it("labels every template in plain words, never its id", () => {
    for (const name of templateNames) {
      const label = EMAIL_TEMPLATE_LABELS[name];
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
    }
  });

  it("marks optional mail from the suppression policy", () => {
    expect(describeEmailTemplate("bid-outbid")).toEqual({ label: "Outbid", essential: false });
    expect(describeEmailTemplate("payment-invoice")).toEqual({
      label: "Invoice",
      essential: true,
    });
  });

  it("reads a retired template generically and treats it as essential", () => {
    expect(describeEmailTemplate("retired-thing")).toEqual({ label: "Email", essential: true });
  });
});
