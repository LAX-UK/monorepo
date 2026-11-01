import { describe, expect, it } from "vitest";
import { isCoverFixtureReviewAvailable } from "./cover-fixture-review";

describe("isCoverFixtureReviewAvailable", () => {
  it("serves development and test runs but never a production build", () => {
    expect(isCoverFixtureReviewAvailable("development")).toBe(true);
    expect(isCoverFixtureReviewAvailable("test")).toBe(true);
    expect(isCoverFixtureReviewAvailable("production")).toBe(false);
  });
});
