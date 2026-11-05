import { describe, expect, it } from "vitest";
import { containsPattern, escapeLikePattern, startsWithPattern } from "./like-pattern.js";

describe("escapeLikePattern", () => {
  it("leaves plain text alone", () => {
    expect(escapeLikePattern("monet")).toBe("monet");
  });

  it("escapes a percent sign", () => {
    expect(escapeLikePattern("50%")).toBe("50\\%");
  });

  it("escapes an underscore", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes a backslash", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("escapes a mix, backslash first so nothing is escaped twice", () => {
    expect(escapeLikePattern("\\%_")).toBe("\\\\\\%\\_");
  });

  it("returns an empty string for empty input", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});

describe("containsPattern", () => {
  it("wraps escaped text in wildcards", () => {
    expect(containsPattern("50%")).toBe("%50\\%%");
  });

  it("is just the wildcards for empty input", () => {
    expect(containsPattern("")).toBe("%%");
  });
});

describe("startsWithPattern", () => {
  it("appends one wildcard after escaped text", () => {
    expect(startsWithPattern("lot_")).toBe("lot\\_%");
  });
});
