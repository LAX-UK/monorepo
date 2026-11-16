import { describe, expect, it } from "vitest";
import { parseMarkDemoTargetArgs } from "./mark-demo-target-cli.js";

describe("parseMarkDemoTargetArgs", () => {
  it("defaults to a local mark by ci", () => {
    expect(parseMarkDemoTargetArgs([])).toEqual({ environment: "local", markedBy: "ci" });
  });
  it("accepts test and local only", () => {
    expect(parseMarkDemoTargetArgs(["test", "ops"]).environment).toBe("test");
    expect(() => parseMarkDemoTargetArgs(["production"])).toThrow(/"test" or "local"/);
  });
});
