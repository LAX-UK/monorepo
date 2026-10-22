import { describe, expect, it } from "vitest";
import { normaliseBackupCode, normaliseTotpCode } from "./code-entry.js";

describe("normaliseTotpCode", () => {
  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
    [" 123 456 ", "123456"],
    ["123 456", "123456"],
    ["123–456", "123456"],
    ["1 2 3 - 4 5 6", "123456"],
  ])("turns %j into %j", (raw, expected) => {
    expect(normaliseTotpCode(raw)).toBe(expected);
  });

  it("leaves letters alone for the field's own validation to reject", () => {
    expect(normaliseTotpCode("12a 456")).toBe("12a456");
  });
});

describe("normaliseBackupCode", () => {
  it("keeps the case and the hyphen of a code pasted as shown", () => {
    expect(normaliseBackupCode("aB3dE-fG5hJ")).toBe("aB3dE-fG5hJ");
  });

  it("puts the hyphen back when it was dropped or replaced by a space", () => {
    expect(normaliseBackupCode("aB3dEfG5hJ")).toBe("aB3dE-fG5hJ");
    expect(normaliseBackupCode(" aB3dE fG5hJ ")).toBe("aB3dE-fG5hJ");
  });

  it("does not invent a format for input of the wrong length", () => {
    expect(normaliseBackupCode("aB3dE-fG5")).toBe("aB3dEfG5");
  });
});
