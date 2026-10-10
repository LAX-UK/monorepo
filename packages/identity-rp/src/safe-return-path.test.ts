import { describe, expect, it } from "vitest";
import { safeRelativeReturnPath } from "./safe-return-path.js";

describe("safeRelativeReturnPath", () => {
  it.each(["/", "/account", "/checkout?step=2#pay", " /cart "])("accepts %s", (raw) => {
    expect(safeRelativeReturnPath(raw)).toBe(raw.trim());
  });

  it.each([
    null,
    undefined,
    "",
    "account",
    "//evil.example",
    "/\\evil.example",
    "/%5Cevil.example\\",
    "https://evil.example",
    "javascript:alert(1)",
    "/\tevil",
    "/\n/evil.example",
  ])("rejects %s", (raw) => {
    expect(safeRelativeReturnPath(raw)).toBeNull();
  });
});
