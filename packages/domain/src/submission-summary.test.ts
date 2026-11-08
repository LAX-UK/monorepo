import { describe, expect, it } from "vitest";
import { summariseSubmissionCounts } from "./submission-summary.js";

const base = {
  draft: 0,
  submitted: 0,
  under_review: 0,
  changes_requested: 0,
  approved: 0,
  converted: 0,
  rejected: 0,
  withdrawn: 0,
};

describe("summariseSubmissionCounts", () => {
  it("totals every status and calls out drafts and sent-back work", () => {
    const summary = summariseSubmissionCounts({
      ...base,
      draft: 2,
      changes_requested: 3,
      submitted: 1,
    });
    expect(summary).toMatchObject({ total: 6, drafts: 2, needsChanges: 3 });
  });

  it("is zero when nothing is waiting", () => {
    expect(summariseSubmissionCounts(base)).toMatchObject({
      total: 0,
      drafts: 0,
      needsChanges: 0,
    });
  });

  it("treats a missing status as zero", () => {
    const partial = { submitted: 4 } as unknown as typeof base;
    expect(summariseSubmissionCounts(partial)).toMatchObject({ drafts: 0, needsChanges: 0 });
  });
});
