import { describe, expect, it } from "vitest";
import { parseBooleanFlag, parseOptionalBooleanFlag } from "./boolean-flag.js";

describe("parseBooleanFlag", () => {
  it.each(["1", "true", "yes", "on", "TRUE", " Yes ", "On"])("parses %j as true", (value) => {
    expect(parseBooleanFlag(value)).toBe(true);
  });

  it.each(["0", "false", "no", "off", "FALSE", " No ", "Off"])("parses %j as false", (value) => {
    expect(parseBooleanFlag(value)).toBe(false);
  });

  it.each([undefined, "", "   ", "maybe", "enabled"])("returns null for %j", (value) => {
    expect(parseBooleanFlag(value)).toBeNull();
  });
});

describe("parseOptionalBooleanFlag", () => {
  it("accepts boolean literals and shared string tokens", () => {
    expect(parseOptionalBooleanFlag(true)).toBe(true);
    expect(parseOptionalBooleanFlag(false)).toBe(false);
    expect(parseOptionalBooleanFlag("1")).toBe(true);
    expect(parseOptionalBooleanFlag("yes")).toBe(true);
    expect(parseOptionalBooleanFlag("off")).toBe(false);
  });

  it("treats empty or unknown values as unset so callers can apply fallbacks", () => {
    expect(parseOptionalBooleanFlag(undefined)).toBeUndefined();
    expect(parseOptionalBooleanFlag("")).toBeUndefined();
    expect(parseOptionalBooleanFlag("maybe")).toBeUndefined();
  });
});
