import { describe, expect, it } from "vitest";
import {
  purchaseProblemFormSchema,
  purchaseProblemHref,
  purchaseProblemPanel,
} from "./purchase-problem";

describe("purchaseProblemHref", () => {
  it("opens the form on the purchase itself", () => {
    expect(purchaseProblemHref("lot-5")).toBe("/purchases/lot-5/report-problem");
  });
});

describe("purchaseProblemFormSchema", () => {
  it("accepts a category with a message", () => {
    expect(
      purchaseProblemFormSchema.safeParse({
        category: "damaged",
        message: "  The frame arrived cracked.  ",
      }),
    ).toMatchObject({ success: true, data: { message: "The frame arrived cracked." } });
  });

  it("says what is missing in the words the summary shows", () => {
    const result = purchaseProblemFormSchema.safeParse({ category: "", message: "short" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((i) => i.message)).toEqual([
      "Choose what the problem is about",
      "Tell us what happened, in at least 10 characters",
    ]);
  });
});

describe("purchaseProblemPanel", () => {
  it("shows the reference, the topic, the date and what happens next", () => {
    const panel = purchaseProblemPanel({
      reference: "PR-3F2A9C1E",
      category: "not_received",
      reportedAt: new Date("2026-11-02T10:00:00Z"),
    });
    expect(panel).toMatchObject({
      title: "Problem reported",
      reference: "PR-3F2A9C1E",
      facts: [
        { label: "About", value: "Not received" },
        { label: "Reported", value: "2 Nov 2026" },
      ],
    });
    expect(panel.nextStep).toContain("two business days");
  });
});
