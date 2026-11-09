import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const base = { recipientFirstName: "Mo", supportContactEmail: "support@lax.bid" };

describe("kyc-retention-hold-notice", () => {
  it("lists the deals and says nothing releases the hold by itself", async () => {
    const email = await renderEmail("kyc-retention-hold-notice", {
      ...base,
      count: 2,
      lines: [
        "PS-0042: ended, but no end date is recorded, so the hold has no end",
        "PS-0050: still open, and has not changed stage for longer than the retention period",
      ],
    });
    expect(email.subject).toBe("2 private sale holds on KYC evidence need a look");
    expect(email.text).toContain("PS-0042");
    expect(email.text).toContain("PS-0050");
    expect(email.text).toContain("nothing will release it by itself");
  });

  it("uses the singular for one deal, and counts the ones not listed", async () => {
    const one = await renderEmail("kyc-retention-hold-notice", {
      ...base,
      count: 1,
      lines: ["PS-0042: ended, but no end date is recorded, so the hold has no end"],
    });
    expect(one.subject).toBe("A private sale hold on KYC evidence needs a look");
    const many = await renderEmail("kyc-retention-hold-notice", {
      ...base,
      count: 25,
      lines: Array.from({ length: 20 }, (_, i) => `PS-${i + 1}: needs a look`),
    });
    expect(many.text).toContain("and 5 more");
  });

  it("holds no contact details", async () => {
    const email = await renderEmail("kyc-retention-hold-notice", {
      ...base,
      count: 1,
      lines: ["PS-0042: needs a look"],
    });
    expect(email.text).not.toMatch(/@(?!lax)/);
  });
});
