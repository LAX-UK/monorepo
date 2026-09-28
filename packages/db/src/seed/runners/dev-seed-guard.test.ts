import { describe, expect, it } from "vitest";
import { isRemoteOrProtectedSeedTarget } from "./dev-seed-guard.js";

describe("isRemoteOrProtectedSeedTarget", () => {
  it("treats APP_ENV=test as protected even on localhost", () => {
    expect(
      isRemoteOrProtectedSeedTarget({
        databaseUrl: "postgresql://u:p@localhost:5432/db",
        appEnv: "test",
      }),
    ).toBe(true);
  });

  it("allows local dev without APP_ENV=test", () => {
    expect(
      isRemoteOrProtectedSeedTarget({
        databaseUrl: "postgresql://u:p@127.0.0.1:5432/db",
        appEnv: "development",
      }),
    ).toBe(false);
  });

  it("treats remote hosts as protected", () => {
    expect(
      isRemoteOrProtectedSeedTarget({
        databaseUrl:
          "postgresql://u:p@db-postgresql-fra1-do-user-123.db.ondigitalocean.com:25060/defaultdb",
      }),
    ).toBe(true);
  });
});
