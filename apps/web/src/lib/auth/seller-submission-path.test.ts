import { describe, expect, it } from "vitest";
import { isSellerSubmissionPath, sellLoginRedirect } from "./seller-submission-path";

describe("seller-submission-path", () => {
  it("detects submission wizard routes", () => {
    expect(isSellerSubmissionPath("/dashboard/submissions/new")).toBe(true);
    expect(isSellerSubmissionPath("/dashboard/submissions/new?categorySlug=watches-clocks")).toBe(
      true,
    );
    expect(isSellerSubmissionPath("/dashboard/submissions/sub-1")).toBe(true);
    expect(isSellerSubmissionPath("/dashboard/seller")).toBe(false);
  });

  it("builds sell login redirect with intent", () => {
    expect(sellLoginRedirect("/dashboard/submissions/new")).toBe(
      "/login?next=%2Fdashboard%2Fsubmissions%2Fnew&intent=sell",
    );
  });
});
