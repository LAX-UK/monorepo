import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeReturnTo("/account?tab=security")).toBe("/account?tab=security");
  });

  it("falls back for paths that could leave the origin", () => {
    for (const unsafe of [
      "//evil.example",
      "/\\evil.example",
      "/\n//evil.example",
      "https://evil.example",
      "account",
      "",
      null,
    ]) {
      expect(safeReturnTo(unsafe)).toBe("/account");
    }
  });
});
