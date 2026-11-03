import { describe, expect, it } from "vitest";
import { isCoverFixtureReviewAvailable } from "./cover-fixture-review";

describe("isCoverFixtureReviewAvailable", () => {
  it("serves development and test runs but never a production build", () => {
    expect(isCoverFixtureReviewAvailable("development")).toBe(true);
    expect(isCoverFixtureReviewAvailable("test")).toBe(true);
    expect(isCoverFixtureReviewAvailable("production")).toBe(false);
  });

  it("serves a production build only when started for the visual tests", () => {
    expect(isCoverFixtureReviewAvailable("production", "1")).toBe(true);
    expect(isCoverFixtureReviewAvailable("production", "0")).toBe(false);
    expect(isCoverFixtureReviewAvailable("production", undefined)).toBe(false);
  });
});
