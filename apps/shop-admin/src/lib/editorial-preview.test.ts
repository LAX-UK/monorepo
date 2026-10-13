import { describe, expect, it } from "vitest";
import { buildEditorialPreviewUrl } from "./editorial-preview";

describe("buildEditorialPreviewUrl", () => {
  it("joins the lax.art origin and token", () => {
    expect(buildEditorialPreviewUrl("https://lax.art/", "abc.def")).toBe(
      "https://lax.art/preview/abc.def",
    );
  });

  it("returns null without a configured origin", () => {
    expect(buildEditorialPreviewUrl(undefined, "abc")).toBeNull();
    expect(buildEditorialPreviewUrl("  ", "abc")).toBeNull();
  });
});
