import { describe, expect, it } from "vitest";
import { assertMarkFitsAddress, parseMarkDemoTargetArgs } from "./mark-demo-target-cli.js";

describe("parseMarkDemoTargetArgs", () => {
  it("defaults to a local mark by ci", () => {
    expect(parseMarkDemoTargetArgs([])).toEqual({ environment: "local", markedBy: "ci" });
  });
  it("accepts test and local only", () => {
    expect(parseMarkDemoTargetArgs(["test", "ops"]).environment).toBe("test");
    expect(() => parseMarkDemoTargetArgs(["production"])).toThrow(/"test" or "local"/);
  });
});

describe("assertMarkFitsAddress", () => {
  it("refuses to mark a remote or test database local", () => {
    const local = { environment: "local", markedBy: "ops" } as const;
    expect(() =>
      assertMarkFitsAddress(local, {
        databaseUrl: "postgres://u:p@db.example.com:25060/defaultdb",
      }),
    ).toThrow(/only a local database/);
    expect(() =>
      assertMarkFitsAddress(local, { databaseUrl: "postgres://u:p@localhost/x", appEnv: "test" }),
    ).toThrow(/only a local database/);
    expect(() =>
      assertMarkFitsAddress(local, { databaseUrl: "postgres://u:p@localhost/x" }),
    ).not.toThrow();
    expect(() =>
      assertMarkFitsAddress(
        { environment: "test", markedBy: "ops" },
        { databaseUrl: "postgres://u:p@db.example.com:25060/defaultdb" },
      ),
    ).not.toThrow();
  });
});
