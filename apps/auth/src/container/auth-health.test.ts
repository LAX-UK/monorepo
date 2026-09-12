import type { IdentityDatabase } from "@auction/identity-db";
import { describe, expect, it } from "vitest";
import { assertAuthAtRestReady } from "./auth-health.js";

describe("assertAuthAtRestReady", () => {
  const db = {} as IdentityDatabase;

  it("requires the active encryption key in production", async () => {
    await expect(assertAuthAtRestReady({ db, nodeEnv: "production" })).rejects.toThrow(
      "auth_at_rest_key_required",
    );
  });

  it("does not enforce production storage policy in test", async () => {
    await expect(assertAuthAtRestReady({ db, nodeEnv: "test" })).resolves.toBeUndefined();
  });
});
