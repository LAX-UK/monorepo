import { describe, expect, it } from "vitest";
import { fieldVariantClasses } from "./field-variant.js";

describe("fieldVariantClasses", () => {
  it("defaults to boxed styles", () => {
    expect(fieldVariantClasses(undefined)).toContain("rounded-md");
    expect(fieldVariantClasses(undefined)).toContain("border-outline-variant");
  });

  it("underline variant removes box and uses bottom border", () => {
    const classes = fieldVariantClasses("underline");
    expect(classes).toContain("border-b");
    expect(classes).toContain("rounded-none");
    expect(classes).not.toContain("shadow-sm");
  });
});
