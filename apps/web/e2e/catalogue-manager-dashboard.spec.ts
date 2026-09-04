import {
  dismissStaffPaletteIfOpen,
  e2eEnabled,
  e2eSkipReason,
  ensureCatalogueManagerSession,
  expectNoSeriousAxeViolationsInMain,
  gotoAdminPath,
  persistContextAuthState,
} from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import { expect, test } from "./helpers/auth.fixture";

test.describe("catalogue manager dashboard @roles", () => {
  test.setTimeout(90_000);
  test.skip(!e2eEnabled, e2eSkipReason);

  test("shows the catalogue work inbox and submissions action", async ({ page }) => {
    await ensureCatalogueManagerSession(page);
    await gotoAdminPath(page, "/admin");
    await dismissStaffPaletteIfOpen(page);
    await expect(page.getByRole("heading", { name: /good day/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.locator("#main-content").getByRole("link", { name: /^submissions$/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /work inbox/i })).toBeVisible();
    await expectNoSeriousAxeViolationsInMain(page);
    await persistContextAuthState(page.context(), roleAuthState.catalogueManager);
  });
});
