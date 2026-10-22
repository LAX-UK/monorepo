import { describe, expect, it } from "vitest";
import { cleanProductFields, cleanSku } from "./merchandise-input.js";

describe("cleanProductFields", () => {
  it("trims the text and keeps a real description", () => {
    expect(
      cleanProductFields({ slug: " tote ", title: "  Tote bag ", description: " Canvas. " }),
    ).toEqual({ slug: "tote", title: "Tote bag", description: "Canvas." });
  });

  it("stores a blank description as none", () => {
    expect(
      cleanProductFields({ slug: "tote", title: "Tote", description: "   " }).description,
    ).toBe(null);
  });

  it("rejects a title that is only whitespace", () => {
    expect(() => cleanProductFields({ slug: "tote", title: "  ", description: null })).toThrow(
      "Title is required",
    );
  });
});

describe("cleanSku", () => {
  it("trims", () => {
    expect(cleanSku(" TOTE-01 ")).toBe("TOTE-01");
  });

  it("rejects a blank SKU", () => {
    expect(() => cleanSku(" ")).toThrow("SKU is required");
  });
});
