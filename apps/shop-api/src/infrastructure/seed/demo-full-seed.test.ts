import { describe, expect, it } from "vitest";
import { assertDemoSeedTarget } from "./demo-full-seed.js";

describe("assertDemoSeedTarget", () => {
  it("refuses production by environment or host", () => {
    expect(() =>
      assertDemoSeedTarget({
        databaseUrl: "postgres://u:p@db.example.com/x",
        appEnv: "production",
      }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoSeedTarget({ databaseUrl: "postgres://u:p@prod-shop.example.com/x" }),
    ).toThrow(/production/);
  });
  it("needs a database url and accepts a test host", () => {
    expect(() => assertDemoSeedTarget({ databaseUrl: undefined })).toThrow(/required/);
    expect(
      assertDemoSeedTarget({ databaseUrl: "postgres://u:p@test-shop-db.example.com/x" }),
    ).toContain("test-shop-db");
  });
});
