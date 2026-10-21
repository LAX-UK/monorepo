import { describe, expect, it } from "vitest";
import { containsPattern } from "./drizzle-editorial-search.reader.js";

describe("containsPattern", () => {
  it("wraps the trimmed term for a substring match", () => {
    expect(containsPattern("  summer show ")).toBe("%summer show%");
  });

  it("escapes LIKE wildcards and the escape character", () => {
    expect(containsPattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
