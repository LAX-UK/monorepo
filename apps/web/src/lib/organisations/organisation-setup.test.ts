import type { LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { organisationSellingNote, setupStep } from "./organisation-setup";

describe("setupStep", () => {
  it("resumes where the onboarding read says", () => {
    expect(setupStep("connect_pending", "o1", "/resume")).toEqual({
      label: "Finish payout setup",
      href: "/resume",
    });
  });

  it("falls back to the step the status implies", () => {
    expect(setupStep("docs_requested", "o1")).toMatchObject({ label: "Continue setup" });
    expect(setupStep("docs_requested", "o1")?.href).toContain("o1");
  });

  it("has no step once approved or closed", () => {
    for (const status of ["approved", "archived", "rejected", "restricted"] as const) {
      expect(setupStep(status, "o1")).toBeNull();
    }
  });
});

describe("organisationSellingNote", () => {
  it("asks for documents, with the step, while they are requested", () => {
    for (const status of ["lead", "docs_requested"] as const) {
      const note = organisationSellingNote(status, "o1");
      expect(note?.summary).toBe("Documents needed. You can save a draft now.");
      expect(note?.notice).toMatch(/waiting for this organisation's documents/);
      expect(note?.step?.label).toBe("Continue setup");
    }
  });

  it("keeps the review wording, with no step, while LAX checks", () => {
    for (const status of ["docs_received", "under_review"] as const) {
      const note = organisationSellingNote(status, "o1");
      expect(note?.summary).toBe("Under review. You can save a draft now.");
      expect(note?.notice).toMatch(/still checking this organisation's documents/);
      expect(note?.step).toBeNull();
    }
  });

  it("says payouts are not set up, with the step", () => {
    const note = organisationSellingNote("connect_pending", "o1");
    expect(note?.summary).toBe("Payouts not set up. You can save a draft now.");
    expect(note?.notice).toMatch(/payouts aren't set up/);
    expect(note?.step?.label).toBe("Finish payout setup");
  });

  it("leaves the states that cannot draft, or can send, with the default", () => {
    const rest: LegalEntityStatus[] = ["approved", "restricted", "rejected", "archived"];
    for (const status of rest) expect(organisationSellingNote(status, "o1")).toBeNull();
  });
});
