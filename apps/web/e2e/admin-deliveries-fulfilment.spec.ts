import { randomUUID } from "node:crypto";
import type { Page, TestInfo } from "@playwright/test";
import { operationsLogin } from "./helpers/auth";
import { expect, test } from "./helpers/auth.fixture";
import { shoot } from "./helpers/collection-journeys";
import {
  type SeededDeliveries,
  bookDelivery,
  removeDeliveryRequests,
  requireDeliveriesStack,
  seedDeliveryRequests,
} from "./helpers/deliveries-seed";

/**
 * Bid admin › Deliveries, part 4 (docs/design/staff-gaps-delivery-zoho-alerts.md, D4, D5 and D9):
 * a booked delivery links to its next step on Lot fulfilment, where the step is taken. To dispatch
 * offers "Ship lot on Lot fulfilment", On the way "Mark delivered on Lot fulfilment", Delivered
 * nothing more; the link lands on that lot's record on Lot fulfilment with its step as the
 * panel's primary action.
 *
 * The journey makes its own made-up sale, lots and bookings and removes them afterwards. Tagged
 * `@smoke` so the PR browser gate runs it; it never skips.
 */

const TAG = `E2F ${randomUUID().slice(0, 6)}`;
const FIRST_LOT = 970;
const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;

async function shootSchemes(page: Page, testInfo: TestInfo, name: string, size: string) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    // The theme change cross-fades colours; shoot once it has settled.
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== "running"),
    );
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    await shoot(page, testInfo, `deliveries-fulfilment-${name}-${size}-${scheme}`);
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}

test.describe("deliveries fulfilment steps @smoke @journey", () => {
  test.describe.configure({ retries: 0, mode: "serial" });
  // Signs in as Operations (Fulfilment) itself, rather than as the shared staff session.
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededDeliveries | null = null;
  test.beforeAll(async () => {
    requireDeliveriesStack();
    seeded = await seedDeliveryRequests(TAG, {
      count: 3,
      firstLotNumber: FIRST_LOT,
      titlePrefix: "Dispatch study",
    });
    const [toDispatch, onTheWay, delivered] = seeded.lotIds as [string, string, string];
    await bookDelivery(toDispatch, "released");
    await bookDelivery(onTheWay, "in_transit");
    await bookDelivery(delivered, "delivered");
  });
  test.afterAll(async () => {
    await removeDeliveryRequests(seeded);
  });

  for (const size of SIZES) {
    test(`links each booked delivery to its Lot fulfilment step, at ${size.name}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      if (!seeded) throw new Error("The journey's requests were not added");
      const [toDispatch, onTheWay, delivered] = seeded.lotIds as [string, string, string];
      const shootAll = (name: string) => shootSchemes(page, testInfo, name, size.name);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await operationsLogin(page);
      const q = encodeURIComponent(TAG);

      await test.step("To dispatch: Ship lot on Lot fulfilment in the footer and the row menu", async () => {
        await page.goto(`/admin/deliveries?view=to_dispatch&q=${q}`);
        const title = `Lot ${FIRST_LOT} · Dispatch study 1`;
        await page
          .getByRole("button", { name: `Actions for ${title}` })
          .first()
          .click();
        const step = page.getByRole("menuitem", { name: "Ship lot on Lot fulfilment" });
        await expect(step).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Open lot fulfilment" })).toHaveCount(0);
        await shootAll("1-to-dispatch-menu");
        await page.keyboard.press("Escape");

        await page.goto(`/admin/deliveries?view=to_dispatch&q=${q}&record=${toDispatch}`);
        const panel = page.getByRole("dialog", { name: title });
        await expect(panel).toBeVisible();
        const link = panel
          .locator("[data-staff-panel-footer]")
          .getByRole("link", { name: "Ship lot on Lot fulfilment" });
        await expect(link).toHaveAttribute(
          "href",
          `/admin/lot-fulfilment?q=${toDispatch}&lot=${toDispatch}`,
        );
        await expect(
          panel.getByText(
            "Release, dispatch, tracking and delivery are recorded on Lot fulfilment.",
          ),
        ).toBeVisible();
        await shootAll("2-to-dispatch-panel");

        await link.click();
        await expect(page).toHaveURL(new RegExp(`/admin/lot-fulfilment\\?q=${toDispatch}`));
        const record = page.getByRole("dialog", { name: "Dispatch study 1" });
        await expect(record).toBeVisible();
        await expect(record.getByRole("button", { name: "Ship lot" })).toBeVisible();
        await shootAll("3-lot-fulfilment-landing");
      });

      await test.step("On the way: Mark delivered on Lot fulfilment", async () => {
        await page.goto(`/admin/deliveries?view=on_the_way&q=${q}&record=${onTheWay}`);
        const panel = page.getByRole("dialog", { name: `Lot ${FIRST_LOT + 1} · Dispatch study 2` });
        await expect(panel).toBeVisible();
        await expect(
          panel
            .locator("[data-staff-panel-footer]")
            .getByRole("link", { name: "Mark delivered on Lot fulfilment" }),
        ).toBeVisible();
        await shootAll("4-on-the-way-panel");
      });

      await test.step("Delivered: no step left, only the record's full page", async () => {
        await page.goto(`/admin/deliveries?view=delivered&q=${q}&record=${delivered}`);
        const panel = page.getByRole("dialog", { name: `Lot ${FIRST_LOT + 2} · Dispatch study 3` });
        await expect(panel).toBeVisible();
        await expect(panel.locator("[data-staff-panel-footer]")).toHaveCount(0);
        await expect(panel.getByRole("link", { name: /Open full page/ })).toBeVisible();
        await shootAll("5-delivered-panel");
      });
    });
  }
});
