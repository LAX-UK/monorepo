import { describe, expect, it } from "vitest";
import { fieldVariantClasses } from "./field-variant.js";

describe("fieldVariantClasses", () => {
  it("defaults to boxed styles", () => {
    expect(fieldVariantClasses(undefined)).toContain("rounded-md");
  });

  it("boxed edge uses the 3:1 field border token, not the faint outline", () => {
    const classes = fieldVariantClasses("boxed");
    expect(classes).toContain("border-input-border");
    expect(classes).not.toContain("outline-variant");
  });

  it("underline variant removes box and uses bottom border", () => {
    const classes = fieldVariantClasses("underline");
    expect(classes).toContain("border-b");
    expect(classes).toContain("rounded-none");
    expect(classes).not.toContain("shadow-sm");
  });

  it("underline edge uses the 3:1 field border token", () => {
    const classes = fieldVariantClasses("underline");
    expect(classes).toContain("border-input-border");
    expect(classes).not.toContain("outline-variant");
  });
});
