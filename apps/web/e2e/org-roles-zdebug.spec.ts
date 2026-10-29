import { expect, test } from "@playwright/test";
import { roleAuthState } from "./helpers/auth-state";
import { ORGANISATION_JOURNEY_NAMES, openAs } from "./helpers/organisation-journeys";

const { approved, other } = ORGANISATION_JOURNEY_NAMES;

test.describe("zdebug switch @roles", () => {
  test("diagnose second switch", async ({ browser, baseURL }) => {
    test.setTimeout(170_000);
    const report: string[] = [];
    for (let round = 0; round < 5; round++) {
      const owner = await openAs(browser, roleAuthState.buyer, approved, baseURL);
      const { page, origin } = owner;
      const log: string[] = [];
      const t0 = Date.now();
      const stamp = () => `${Date.now() - t0}ms`;
      page.on("request", (r) => {
        const rsc = r.headers().rsc;
        if (r.method() === "POST" || rsc) {
          log.push(`${stamp()} > ${r.method()} ${r.url().replace(origin, "")} rsc=${rsc ?? "-"}`);
        }
      });
      page.on("response", (r) => {
        const req = r.request();
        if (req.method() === "POST" || req.headers().rsc) {
          log.push(`${stamp()} < ${r.status()} ${r.url().replace(origin, "")}`);
        }
      });
      const cookie = () =>
        page.evaluate(
          () => /lax_acting_legal_entity_id=([^;]+)/.exec(document.cookie)?.[1] ?? "(none)",
        );
      const strip = async () =>
        (
          await page
            .getByTestId("account-strip")
            .innerText()
            .catch(() => "?")
        ).replace(/\s+/g, " ");

      await page.goto("/organisation/members");
      for (const [from, to] of [
        [approved, other],
        [other, approved],
      ] as const) {
        log.push(`${stamp()} switch ${from} -> ${to}`);
        await page
          .getByRole("button", { name: `Account: ${from},` })
          .first()
          .click();
        await page.getByTestId("switch-account-organisation").filter({ hasText: to }).click();
        let settled = false;
        for (let i = 0; i < 16 && !settled; i++) {
          await page.waitForTimeout(500);
          const text = await strip();
          settled = text.includes(to);
          if (i % 4 === 3 || settled) {
            log.push(`${stamp()} strip="${text}" cookie=${await cookie()} url=${page.url()}`);
          }
        }
        if (!settled) {
          log.push(`${stamp()} STALE; trying router.refresh()`);
          await page.evaluate(() =>
            (window as { next?: { router?: { refresh(): void } } }).next?.router?.refresh(),
          );
          await page.waitForTimeout(3000);
          log.push(`${stamp()} after refresh strip="${await strip()}"`);
          await page.reload();
          log.push(`${stamp()} after reload strip="${await strip()}" cookie=${await cookie()}`);
        }
        await page.waitForLoadState("networkidle");
      }
      report.push(`--- round ${round}\n${log.join("\n")}`);
      await owner.close();
    }
    expect(true, report.join("\n")).toBe(false);
  });
});
