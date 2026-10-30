import { describe, expect, it } from "vitest";
import { isClientKitReviewAvailable } from "./client-kit-review";

describe("client kit review page", () => {
  it("is served in development and tests", () => {
    expect(isClientKitReviewAvailable("development")).toBe(true);
    expect(isClientKitReviewAvailable("test")).toBe(true);
  });

  it("never exists in a production build", () => {
    expect(isClientKitReviewAvailable("production")).toBe(false);
  });
});
