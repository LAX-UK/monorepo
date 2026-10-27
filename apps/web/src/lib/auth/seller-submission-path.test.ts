import { describe, expect, it } from "vitest";
import { isSellerSubmissionPath, sellLoginRedirect } from "./seller-submission-path";

describe("seller-submission-path", () => {
  it("detects submission wizard routes", () => {
    expect(isSellerSubmissionPath("/selling/new")).toBe(true);
    expect(isSellerSubmissionPath("/selling/new?categorySlug=watches-clocks")).toBe(true);
    expect(isSellerSubmissionPath("/selling/consignments/sub-1")).toBe(true);
    expect(isSellerSubmissionPath("/selling")).toBe(false);
  });

  it("builds sell login redirect with intent", () => {
    expect(sellLoginRedirect("/selling/new")).toBe("/login?next=%2Fselling%2Fnew&intent=sell");
  });
});
