import { describe, expect, it } from "vitest";
import { NOTE_MAX_LENGTH, validateClose, validateNote } from "./enquiry-forms";

describe("validateNote", () => {
  it("needs something to say", () => {
    expect(validateNote("   ")).toBe("Write the note before adding it.");
    expect(validateNote("Called the seller.")).toBeNull();
  });

  it("stays within what the API takes", () => {
    expect(validateNote("x".repeat(NOTE_MAX_LENGTH + 1))).toMatch(/under 5000/);
    expect(validateNote("x".repeat(NOTE_MAX_LENGTH))).toBeNull();
  });
});

describe("validateClose", () => {
  it("needs a reason", () => {
    expect(validateClose({ reason: null, note: "" }).reason).toBeDefined();
    expect(validateClose({ reason: "spam", note: "" })).toEqual({});
  });

  it("takes an optional note within the limit", () => {
    expect(
      validateClose({ reason: "spam", note: "x".repeat(NOTE_MAX_LENGTH + 1) }).note,
    ).toBeDefined();
  });
});
