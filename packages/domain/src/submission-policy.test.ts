import { legalEntityStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { sellerSubmissionAccess } from "./submission-policy.js";

describe("sellerSubmissionAccess", () => {
  it("lets a person draft and submit unless the account is closed or rejected", () => {
    for (const status of legalEntityStatuses) {
      const access = sellerSubmissionAccess({ kind: "individual", status });
      const blocked = status === "rejected" || status === "archived";
      expect(access.canDraft).toBe(!blocked);
      expect(access.canSubmit).toBe(!blocked);
    }
  });

  it("lets an approved or restricted organisation submit", () => {
    for (const status of ["approved", "restricted"] as const) {
      expect(sellerSubmissionAccess({ kind: "organisation", status })).toEqual({
        canDraft: true,
        canSubmit: true,
        submitBlockedReason: null,
      });
    }
  });

  it("lets an organisation under review save drafts but not submit, and says why", () => {
    for (const status of [
      "lead",
      "docs_requested",
      "docs_received",
      "under_review",
      "connect_pending",
    ] as const) {
      const access = sellerSubmissionAccess({ kind: "organisation", status });
      expect(access.canDraft).toBe(true);
      expect(access.canSubmit).toBe(false);
      expect(access.submitBlockedReason).toMatch(/still checking/);
    }
  });

  it("blocks a rejected or archived organisation entirely", () => {
    for (const status of ["rejected", "archived"] as const) {
      const access = sellerSubmissionAccess({ kind: "organisation", status });
      expect(access.canDraft).toBe(false);
      expect(access.canSubmit).toBe(false);
    }
  });
});
