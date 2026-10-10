import { test } from "@playwright/test";

/**
 * @optin — requires test auth + staff subject without TOTP; run in stabilization pipeline.
 */
test.describe.skip("staff MFA setup during sign-in @optin", () => {
  test("reaches hosted setup then shop admin home", async () => {
    // Covered by unit/integration gates; enable when test staff fixtures are stable.
  });
});
