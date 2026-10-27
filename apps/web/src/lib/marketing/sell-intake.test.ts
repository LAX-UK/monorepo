import { describe, expect, it } from "vitest";
import {
  sellIntakeHref,
  sellRegisterHrefFromSubmissionNext,
  sellSubmissionPath,
} from "./sell-intake";

describe("sell-intake", () => {
  it("sellIntakeHref points at the submission wizard", () => {
    expect(sellIntakeHref()).toBe("/selling/new");
    expect(sellIntakeHref({ categorySlug: "motor-cars" })).toBe(
      "/selling/new?categorySlug=motor-cars",
    );
  });

  it("sellSubmissionPath matches sellIntakeHref", () => {
    expect(sellSubmissionPath({ categorySlug: "watches-clocks" })).toBe(
      sellIntakeHref({
        categorySlug: "watches-clocks",
      }),
    );
  });

  it("sellRegisterHrefFromSubmissionNext preserves categorySlug from next", () => {
    expect(sellRegisterHrefFromSubmissionNext("/selling/new?categorySlug=fine-prints")).toBe(
      "/register?next=%2Fselling%2Fnew%3FcategorySlug%3Dfine-prints&intent=sell",
    );
  });
});
