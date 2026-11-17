import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { openStaffPage } from "./page-session.js";

/**
 * The release-alert send log's fixture releases (apps/shop-api/src/infrastructure/seed/
 * release-alert-sends-seed.ts) and the checks more than one spec makes against them. Literals
 * rather than imports, so the specs do not load the contracts package or shop-api.
 */
export const RELEASE_ALERTS_PATH = "/leads/release-alerts";

/** In CI, where the gate must run, a missing prerequisite fails; elsewhere it skips, saying why. */
export function releaseAlertPrerequisite(ready: boolean, what: string) {
  if (ready) return;
  if (process.env.CI) throw new Error(`Release alerts e2e cannot run: ${what}`);
  test.skip(true, what);
}

/** Writes the fixture releases through the guarded seed; a second run changes nothing. */
export function seedReleaseAlertFixtures() {
  releaseAlertPrerequisite(
    Boolean(process.env.DATABASE_URL),
    "DATABASE_URL (a hermetic local database) is needed to seed the fixture releases",
  );
  // The stack's scheduler runs the alert digest task. Under any mode but "off" it would send the
  // Sending and Not sent yet fixtures' digests and both would read as Sent (see the seed).
  releaseAlertPrerequisite(
    (process.env.ALERTS_SEND_MODE ?? "off") === "off",
    `ALERTS_SEND_MODE must be "off" for the fixture releases to hold still (it is "${process.env.ALERTS_SEND_MODE}")`,
  );
  if (!process.env.DATABASE_URL) return;
  execFileSync("pnpm", ["--filter", "@auction/shop-api", "seed:release-alert-sends"], {
    cwd: join(import.meta.dirname, "..", "..", "..", ".."),
    stdio: "inherit",
    env: process.env,
  });
}

/**
 * A role that reads leads but cannot open artworks (the account manager) reads the log, and its
 * release panel offers no artwork link. Run inside the role's own signed-in session, so it costs
 * no sign-in of its own: every sign-in counts against the identity service's per-address limit,
 * which all the LAX Admin checks in the run share.
 */
export async function expectReleaseAlertsWithoutArtworks(page: Page) {
  seedReleaseAlertFixtures();
  await openStaffPage(page, "/leads");
  await page.getByRole("link", { name: "Release alerts", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${RELEASE_ALERTS_PATH}$`));
  const grid = page.getByRole("grid", { name: "Release alerts" });
  await grid
    .getByRole("row")
    .filter({ hasText: "Tidal study" })
    .getByRole("link", { name: "Tidal study", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: /Tidal study/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "Open artwork" })).toHaveCount(0);
}
