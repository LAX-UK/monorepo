import { describe, expect, it } from "vitest";
import { parseBooleanFlag } from "./parse-boolean-flag";

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
