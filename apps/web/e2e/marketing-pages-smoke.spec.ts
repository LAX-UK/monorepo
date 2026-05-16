import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

function formatAxeViolations(
  violations: ReadonlyArray<{ id: string; impact?: string | null; help: string }>,
) {
  return violations.map((v) => `  - ${v.id} (${v.impact ?? "?"}): ${v.help}`).join("\n");
}

test.describe("marketing pages smoke", () => {
  for (const path of [
    "/",
    "/search",
    "/archive",
    "/legal",
    "/about",
    "/privacy",
    "/terms",
    "/contact",
    "/artists",
  ]) {
    test(`${path} responds, exposes main landmark, and has no wcag2a/2aa violations in #main-content`, async ({
      page,
    }) => {
      test.skip(!enabled, skipReason);
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.locator("#main-content")).toBeVisible();

      const axe = await new AxeBuilder({ page })
        .include("#main-content")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const blocking = axe.violations.filter((v) =>
        ["critical", "serious", "moderate"].includes(v.impact ?? ""),
      );
      expect(
        blocking,
        `Axe (critical/serious/moderate, wcag2a/2aa in #main-content) on ${path}:\n${formatAxeViolations(blocking)}`,
      ).toEqual([]);
    });
  }
});
