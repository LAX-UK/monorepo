import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { withFailedJobsNavCount } from "./failed-jobs-nav-count";

const counts = { ...EMPTY_ADMIN_NAV_COUNTS, failedJobsNeedsReview: 7 };

describe("withFailedJobsNavCount", () => {
  it("keeps the shared count for people who may read background jobs", () => {
    expect(withFailedJobsNavCount(counts, "staff", ["administrator"]).failedJobsNeedsReview).toBe(
      7,
    );
    expect(withFailedJobsNavCount(counts, "staff", ["read_only"]).failedJobsNeedsReview).toBe(7);
  });

  it("hides it from people who may only see integrations", () => {
    expect(withFailedJobsNavCount(counts, "staff", ["finance"]).failedJobsNeedsReview).toBe(0);
  });

  it("reads a response cached before the count existed as zero", () => {
    const { failedJobsNeedsReview: _missing, ...old } = counts;
    expect(
      withFailedJobsNavCount(old as typeof counts, "staff", ["administrator"])
        .failedJobsNeedsReview,
    ).toBe(0);
  });
});
