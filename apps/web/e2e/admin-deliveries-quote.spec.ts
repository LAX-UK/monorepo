import { randomUUID } from "node:crypto";
import type { Page, TestInfo } from "@playwright/test";
import { operationsLogin } from "./helpers/auth";
import { expect, test } from "./helpers/auth.fixture";
import { shoot } from "./helpers/collection-journeys";
import {
  type SeededDeliveries,
  readDeliveryQuote,
  readQuoteReadyNotices,
  removeDeliveryRequests,
  requireDeliveriesStack,
  seedDeliveryRequests,
  withdrawDeliveryRequest,
} from "./helpers/deliveries-seed";

/**
 * Bid admin › Deliveries, part 2b (docs/design/staff-gaps-delivery-zoho-alerts.md, D5 and D6):
 * Fulfilment sends a buyer a delivery price from the queue panel, confirms it, sees it sent and
 * the buyer told; changes it; and is told when the buyer withdrew while they were pricing.
 *
 * The journey makes its own made-up sale, two won lots and their requests, and removes them
 * afterwards. It signs in afresh as Operations (Fulfilment), since pricing a quote is a money
 * action that needs a recent sign-in (step-up). Tagged `@smoke` so the PR browser gate runs it;
 * it never skips: without the e2e stack, credentials or `DATABASE_URL` it fails and says why.
 */

const TAG = `E2Q ${randomUUID().slice(0, 6)}`;
/**
 * The journey runs once per width: going from 1440 to 375 turns the side panel into the one over
 * the list, which mounts it again, so a dialog open inside it would start over. Light and dark are
 * shot at each state without leaving it.
 */
const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;

async function shootSchemes(page: Page, testInfo: TestInfo, name: string, size: string) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await shoot(page, testInfo, `deliveries-quote-${name}-${size}-${scheme}`);
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}

test.describe("deliveries quote @smoke @journey", () => {
  test.describe.configure({ retries: 0, mode: "serial" });
  // A fresh sign-in, so the step-up check sees a recent one.
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededDeliveries | null = null;
  test.beforeAll(async () => {
    requireDeliveriesStack();
    seeded = await seedDeliveryRequests(TAG, {
      count: SIZES.length * 2,
      firstLotNumber: 950,
      titlePrefix: "Quote study",
    });
  });
  test.afterAll(async () => {
    await removeDeliveryRequests(seeded);
  });

  for (const [index, size] of SIZES.entries()) {
    test(`sends a quote, changes it, and hears when the buyer withdrew meanwhile, at ${size.name}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      if (!seeded) throw new Error("The journey's requests were not added");
      const first = seeded.lotIds[index * 2] as string;
      const second = seeded.lotIds[index * 2 + 1] as string;
      const firstTitle = `Lot ${950 + index * 2} · Quote study ${index * 2 + 1}`;
      const secondTitle = `Lot ${951 + index * 2} · Quote study ${index * 2 + 2}`;
      const shootAll = (p: Page, info: TestInfo, name: string) =>
        shootSchemes(p, info, name, size.name);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await operationsLogin(page);

      await page.goto(`/admin/deliveries?q=${encodeURIComponent(TAG)}&record=${first}`);
      const panel = page.getByRole("dialog", { name: firstTitle });
      await expect(panel).toBeVisible();
      const footer = panel.locator("[data-staff-panel-footer]");

      await test.step("Send quote asks for a price; one missing field is said there, with focus", async () => {
        await footer.getByRole("button", { name: "Send quote" }).click();
        const dialog = page.getByRole("dialog", { name: `Send quote for ${firstTitle}` });
        await expect(dialog).toBeVisible();
        await shootAll(page, testInfo, "1-send-form");
        await dialog.getByRole("textbox", { name: /^Note to the buyer/ }).focus();
        await dialog.getByRole("button", { name: "Continue" }).click();
        const price = dialog.getByRole("textbox", { name: /^Price/ });
        await expect(dialog.getByText("Enter an amount above zero")).toBeVisible();
        await expect(dialog.getByText("There is a problem")).toHaveCount(0);
        await expect(price).toBeFocused();
        await expect(price).toHaveAttribute("aria-invalid", "true");
        await shootAll(page, testInfo, "2-send-error");
      });

      await test.step("the confirmation says who is emailed, and for how much", async () => {
        const dialog = page.getByRole("dialog", { name: `Send quote for ${firstTitle}` });
        await dialog.getByRole("textbox", { name: /^Price/ }).fill("180");
        await dialog
          .getByRole("textbox", { name: /^Note to the buyer/ })
          .fill("Insured, two-person delivery");
        // Enter submits the form from the keyboard.
        await dialog.getByRole("textbox", { name: /^Price/ }).press("Enter");
        const confirm = page.getByRole("dialog", { name: "Send this quote?" });
        await expect(
          confirm.getByText(
            `Send a quote of £180.00 to Example Buyer ${TAG}? They are emailed and can accept it from their purchase page.`,
          ),
        ).toBeVisible();
        await shootAll(page, testInfo, "3-send-confirm");
        expect((await readDeliveryQuote(first))?.status).toBe("requested");
      });

      await test.step("sent: the toast, the price in the panel, Change quote, and the buyer told", async () => {
        const confirm = page.getByRole("dialog", { name: "Send this quote?" });
        await confirm.getByRole("button", { name: "Send quote" }).click();
        await expect(page.getByText(`Quote sent for ${firstTitle}`)).toBeVisible();
        await expect(confirm).toHaveCount(0);
        await expect(panel.getByText("£180.00").first()).toBeVisible();
        await expect(panel.getByText("Insured, two-person delivery")).toBeVisible();
        await expect(panel.getByText("Quote sent").first()).toBeVisible();
        // Its own quote is not the buyer changing the request.
        await expect(panel.getByText(/The buyer changed this request/)).toHaveCount(0);
        await expect(footer.getByRole("button", { name: "Change quote" })).toBeFocused();
        expect(await readDeliveryQuote(first)).toEqual({
          status: "quoted",
          amount: "180.00",
          quoteNote: "Insured, two-person delivery",
        });
        await expect
          .poll(() => readQuoteReadyNotices(seeded?.userId ?? "", first))
          .toEqual([expect.stringContaining("£180.00")]);
        await shootAll(page, testInfo, "4-sent");
      });

      await test.step("Change quote, by keyboard: pre-filled, the new price confirmed and sent", async () => {
        await footer.getByRole("button", { name: "Change quote" }).press("Enter");
        const dialog = page.getByRole("dialog", { name: `Change quote for ${firstTitle}` });
        const price = dialog.getByRole("textbox", { name: /^Price/ });
        await expect(price).toHaveValue("180.00");
        await expect(price).toBeFocused();
        await expect(dialog.getByText("The buyer was quoted £180.00.")).toBeVisible();
        await price.fill("210.50");
        await shootAll(page, testInfo, "5-change-form");
        await price.press("Enter");
        const confirm = page.getByRole("dialog", { name: "Send the new quote?" });
        await expect(
          confirm.getByText(
            `Send a new quote of £210.50 to Example Buyer ${TAG}? The buyer is emailed the new price. The old one can no longer be accepted.`,
          ),
        ).toBeVisible();
        await shootAll(page, testInfo, "6-change-confirm");
        await confirm.getByRole("button", { name: "Send the new quote" }).click();
        await expect(confirm).toHaveCount(0);
        await expect(panel.getByText("£210.50").first()).toBeVisible();
        expect((await readDeliveryQuote(first))?.amount).toBe("210.50");
        await expect
          .poll(async () => (await readQuoteReadyNotices(seeded?.userId ?? "", first)).length)
          .toBe(2);
        expect((await readQuoteReadyNotices(seeded?.userId ?? "", first))[0]).toContain("£210.50");
      });

      await test.step("the buyer withdrew while staff priced it: said, nothing sent, panel reads again", async () => {
        await page.goto(`/admin/deliveries?q=${encodeURIComponent(TAG)}&record=${second}`);
        const next = page.getByRole("dialog", { name: secondTitle });
        await expect(next).toBeVisible();
        await next
          .locator("[data-staff-panel-footer]")
          .getByRole("button", { name: "Send quote" })
          .click();
        const dialog = page.getByRole("dialog", { name: `Send quote for ${secondTitle}` });
        await dialog.getByRole("textbox", { name: /^Price/ }).fill("95");
        await dialog.getByRole("button", { name: "Continue" }).click();
        await withdrawDeliveryRequest(second);
        await page
          .getByRole("dialog", { name: "Send this quote?" })
          .getByRole("button", { name: "Send quote" })
          .click();
        const alert = page.getByRole("alert").filter({
          hasText: "The buyer changed this request while you were pricing it.",
        });
        await expect(alert).toBeVisible();
        await expect(alert.getByText("Check it and try again.")).toBeVisible();
        await shootAll(page, testInfo, "7-stale");
        await page.getByRole("button", { name: "Back to the delivery" }).click();
        await expect(next.getByText("Withdrawn by buyer").first()).toBeVisible();
        await expect(next.locator("[data-staff-panel-footer]")).toHaveCount(0);
        expect(await readDeliveryQuote(second)).toEqual({
          status: "withdrawn",
          amount: null,
          quoteNote: null,
        });
        expect(await readQuoteReadyNotices(seeded?.userId ?? "", second)).toEqual([]);
      });
    });
  }
});
