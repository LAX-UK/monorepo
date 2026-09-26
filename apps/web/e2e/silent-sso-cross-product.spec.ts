import { test } from "@playwright/test";

/**
 * Cross-product silent SSO on test origins (Bid ↔ Shop).
 * Requires SILENT_SSO_ENABLED on test and a signed-in IdP session.
 */
const silentSsoE2eEnabled = process.env.SILENT_SSO_E2E === "1";

test.describe("silent SSO cross-product", () => {
  test("Bid session enables silent Shop sign-in", async () => {
    test.skip(!silentSsoE2eEnabled, "Set SILENT_SSO_E2E=1 against test origins");
  });
});
