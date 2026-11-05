import { type Page, type WebSocketRoute, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, seededHybridLotId, seededHybridSaleId } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

/** Use PLAYWRIGHT_BASE_URL=http://localhost:3000 — not 127.0.0.1 (API cookie domain). */

const skipReason = `${e2eSkipReason} Hybrid sale id defaults to seeded S.hybridA when PLAYWRIGHT_HYBRID_SALE_ID is unset.`;

const clerkConsole = (page: Page) => page.goto(`/admin/saleroom/${seededHybridSaleId}`);
const lotOnBlockHeading = (page: Page) =>
  page.getByRole("heading", { name: /^lot on block$/i, level: 2 }).first();

/**
 * The seed has Room A live with its third lot (Meridian Drift) on the block, so these tests start
 * from a running session. The test that moves the block on runs last: it changes what is on it.
 */
test.describe("hybrid saleroom clerk @journey", () => {
  // The tests share one seeded room (pause, reconnect, advance), so they run one after another.
  test.describe.configure({ mode: "serial" });
  test.skip(!e2eEnabled, skipReason);

  test("staff can open the clerk console for a hybrid sale", async ({ page }) => {
    await clerkConsole(page);
    await expect(
      page.getByRole("heading", { name: /hybrid day sale — room a/i, level: 1 }),
    ).toBeVisible();
    const controls = page.getByRole("region", { name: /session controls/i });
    await expect(controls.getByRole("button", { name: /^pause$/i })).toBeVisible();
    await expect(controls.getByRole("button", { name: /^close session$/i })).toBeVisible();
    await expect(lotOnBlockHeading(page)).toBeVisible();
    await expect(page.getByText("Hybrid", { exact: true }).first()).toBeVisible();
  });

  test("staff can pause and resume a live session", async ({ page }) => {
    await clerkConsole(page);
    const controls = page.getByRole("region", { name: /session controls/i });
    // A click before the page has hydrated does nothing, so press again until the state moves.
    const press = async (from: RegExp, to: RegExp) => {
      await expect(async () => {
        if (await controls.getByRole("button", { name: from }).isVisible()) {
          await controls.getByRole("button", { name: from }).click();
        }
        await expect(controls.getByRole("button", { name: to })).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 20_000 });
    };
    // The console follows the session through the realtime sidecar: no reload in between.
    await press(/^pause$/i, /^resume$/i);
    await press(/^resume$/i, /^pause$/i);
  });

  test("a quick amount fills the paddle bid, and placing it needs a paddle number", async ({
    page,
  }) => {
    await clerkConsole(page);

    const paddleAmount = page.locator('input[id^="paddle-bid-amount-"]');
    await expect(paddleAmount).toBeVisible();
    // The telephone form has its own quick amounts: pick the one in the paddle form.
    const minimumBid = page.getByRole("button", { name: /^minimum bid/i });
    await page
      .locator("div")
      .filter({ has: paddleAmount })
      .filter({ has: minimumBid })
      .last()
      .getByRole("button", { name: /^minimum bid/i })
      .click();
    await expect(paddleAmount).toHaveValue(/^7,?100(\.00)?$/);

    const place = page.getByRole("button", { name: /^place paddle bid$/i });
    await expect(place).toBeDisabled();
    await page.getByRole("textbox", { name: "Paddle number" }).fill("142");
    await expect(paddleAmount).toHaveValue(/^7,?100(\.00)?$/);
  });

  test("paddle and telephone bid amounts are independent", async ({ page }) => {
    await clerkConsole(page);

    // The seed confirms a telephone line (Room A, lot on the block), so the telephone form shows.
    const paddleAmount = page.locator('input[id^="paddle-bid-amount-"]');
    const telephoneAmount = page.locator('input[id^="telephone-bid-amount-"]');
    await expect(paddleAmount).toBeVisible();
    await expect(telephoneAmount).toBeVisible();
    await expect(page.getByText(/no confirmed telephone lines for this lot/i)).toHaveCount(0);

    await paddleAmount.fill("1500");
    await expect(telephoneAmount).toHaveValue("");
    await telephoneAmount.fill("2000");
    await expect(paddleAmount).toHaveValue("1500");
  });

  test("clerk console refreshes roster after check-in redirect", async ({ page }) => {
    await page.goto(`/admin/sales/${seededHybridSaleId}/registrations#check-in`);
    await expect(page.locator("#check-in")).toBeVisible();

    await page.goto(`/admin/saleroom/${seededHybridSaleId}?checkedIn=1`);
    await expect(lotOnBlockHeading(page)).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Paddle number" })).toBeVisible();
  });

  test("marketing lot page stays open for bidding while the lot is on the block", async ({
    page,
  }) => {
    await page.goto(`/lot/test/${seededHybridLotId}`);
    await expect(page.getByRole("button", { name: /^bid history/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/bidding closed/i)).not.toBeVisible();
  });

  test("clerk session bar shows lot-of-total progress", async ({ page }) => {
    await clerkConsole(page);

    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("clerk console hydrates after reconnect", async ({ page, browser }) => {
    test.setTimeout(90_000);
    // Chromium keeps an open socket through setOffline, so the sidecar link is cut where the
    // page opens it: live sockets are closed, and new ones are held unanswered until the test
    // lets them through.
    let sidecarReachable = true;
    const sockets: WebSocketRoute[] = [];
    const held: WebSocketRoute[] = [];
    const connect = (socket: WebSocketRoute) => {
      socket.connectToServer();
      sockets.push(socket);
    };
    await page.routeWebSocket(/:3002\//, (socket) => {
      if (sidecarReachable) connect(socket);
      else held.push(socket);
    });

    await clerkConsole(page);
    const controls = page.getByRole("region", { name: /session controls/i });
    const connection = page.getByRole("status").filter({ hasText: /connected|reconnecting|lost/i });
    await expect(controls.getByRole("button", { name: /^pause$/i })).toBeVisible();
    await expect.poll(() => sockets.length, { timeout: 15_000 }).toBeGreaterThan(0);

    // A second clerk pauses the session while this console has no connection to hear it.
    const otherContext = await browser.newContext({ storageState: roleAuthState.staff });
    const otherPage = await otherContext.newPage();
    const otherControls = otherPage.getByRole("region", { name: /session controls/i });
    try {
      sidecarReachable = false;
      for (const socket of sockets.splice(0)) await socket.close();
      await expect(connection).not.toContainText("Connected · Listening");
      await expect(connection).toContainText(/reconnecting|connection lost/i);

      await clerkConsole(otherPage);
      // A click before the page has hydrated does nothing: press Pause again until it takes.
      await expect(async () => {
        if (await otherControls.getByRole("button", { name: /^pause$/i }).isVisible()) {
          await otherControls.getByRole("button", { name: /^pause$/i }).click();
        }
        await expect(otherControls.getByRole("button", { name: /^resume$/i })).toBeVisible({
          timeout: 3_000,
        });
      }).toPass({ timeout: 20_000 });
      // Still cut off: this console has not heard about the pause.
      await expect(controls.getByRole("button", { name: /^pause$/i })).toBeVisible();

      sidecarReachable = true;
      for (const socket of held.splice(0)) {
        try {
          connect(socket);
        } catch {
          // The page gave up on this attempt; its next one connects.
        }
      }
      // The console reconnects and re-reads the session: it shows the pause it missed, with no
      // reload of the page.
      await expect(controls.getByRole("button", { name: /^resume$/i })).toBeVisible({
        timeout: 30_000,
      });
      await expect(connection).toContainText("Connected");
    } finally {
      sidecarReachable = true;
      for (const socket of held.splice(0)) {
        try {
          connect(socket);
        } catch {
          // Already closed by the page.
        }
      }
      // Leave the session running for the tests that follow.
      if (await otherControls.getByRole("button", { name: /^resume$/i }).isVisible()) {
        await otherControls.getByRole("button", { name: /^resume$/i }).click();
        await expect(otherControls.getByRole("button", { name: /^pause$/i })).toBeVisible({
          timeout: 15_000,
        });
      }
      await otherContext.close();
    }
  });

  test("operations tab reflects the clerk's move without a full reload", async ({ browser }) => {
    const context = await browser.newContext({ storageState: roleAuthState.staff });
    const opsPage = await context.newPage();
    const clerkPage = await context.newPage();

    await opsPage.goto(`/admin/sales/${seededHybridSaleId}/operations`);
    await expect(opsPage.getByRole("heading", { name: /saleroom operations/i })).toBeVisible();
    await expect(opsPage.getByText(/meridian drift/i).first()).toBeVisible();
    const loadMarker = await opsPage.evaluate(() => {
      const marker = `ops-${Math.random()}`;
      (window as unknown as { __opsLoad: string }).__opsLoad = marker;
      return marker;
    });

    await clerkConsole(clerkPage);
    // Retry the click until the console has moved on, in case it lands before the page is ready.
    await expect(async () => {
      await clerkPage.getByRole("button", { name: /^advance next/i }).click();
      await expect(clerkPage.getByText(/glass horizon/i).first()).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });

    // The sidecar pushes the move to the open operations tab; the page is never reloaded.
    await expect(opsPage.getByText(/glass horizon/i).first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() => opsPage.evaluate(() => (window as unknown as { __opsLoad?: string }).__opsLoad), {
        timeout: 15_000,
      })
      .toBe(loadMarker);

    await context.close();
  });
});

test.describe("hybrid saleroom hub (multi-room live grid) @journey", () => {
  test.skip(!e2eEnabled, skipReason);

  test("live grid lists active hybrid rooms with progress", async ({ page }) => {
    await page.goto("/admin/saleroom");

    await expect(page.getByRole("heading", { name: /rooms to run/i })).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByText(/lot \d+ of \d+|between lots|of \d+ complete/i).first(),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /open console/i }).first()).toBeVisible();
  });

  test("opening a room from the grid lands on its clerk console", async ({ page }) => {
    await page.goto("/admin/saleroom");
    await expect(page.getByRole("heading", { name: /rooms to run/i })).toBeVisible({
      timeout: 15_000,
    });

    await page
      .getByRole("link", { name: /open console/i })
      .first()
      .click();
    await page.waitForURL(/\/admin\/saleroom\/[0-9a-f-]+/i, { timeout: 15_000 });
    await expect(page.getByText(/hybrid|live|paused/i).first()).toBeVisible();
  });

  test("live grid renders a progress bar reflecting completed lots", async ({ page }) => {
    await page.goto("/admin/saleroom");
    await expect(page.getByRole("heading", { name: /rooms to run/i })).toBeVisible({
      timeout: 15_000,
    });

    const progressbar = page.getByRole("progressbar").first();
    await expect(progressbar).toBeVisible();
    const max = await progressbar.getAttribute("aria-valuemax");
    expect(Number(max)).toBeGreaterThan(0);
  });
});
