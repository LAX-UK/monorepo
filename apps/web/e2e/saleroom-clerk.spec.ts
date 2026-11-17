import { type Page, type WebSocketRoute, expect, test } from "@playwright/test";
import { e2eEnabled, e2eSkipReason, seededHybridLotId, seededHybridSaleId } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";

/** Use PLAYWRIGHT_BASE_URL=http://localhost:3000 — not 127.0.0.1 (API cookie domain). */

const skipReason = `${e2eSkipReason} Hybrid sale id defaults to seeded S.hybridA when PLAYWRIGHT_HYBRID_SALE_ID is unset.`;

const clerkConsole = (page: Page) => page.goto(`/admin/saleroom/${seededHybridSaleId}`);
const lotOnBlockHeading = (page: Page) =>
  page.getByRole("heading", { name: /^lot on block$/i, level: 2 }).first();
const sessionControls = (page: Page) => page.getByRole("region", { name: /session controls/i });

type SessionStatus = "none" | "pending" | "live" | "paused" | "ended";

/** The room's state as the API has it, read through the same-origin BFF the console uses. */
async function serverSessionStatus(page: Page): Promise<SessionStatus | null> {
  const res = await page.request.get(`/api/bff/sales/${seededHybridSaleId}/saleroom/status`);
  if (!res.ok()) return null;
  const body = (await res.json().catch(() => null)) as { data?: { status?: SessionStatus } } | null;
  return body?.data?.status ?? null;
}

/**
 * Presses `from` on the open console until the server reports `target`, then waits for the console
 * to offer `to`. A click before the page has hydrated does nothing, so it is pressed again, but
 * only while the server has not taken it yet: pressing Pause on a room the server already paused
 * is refused ("Saleroom must be live to pause").
 */
async function pressUntilServer(
  page: Page,
  from: RegExp,
  target: SessionStatus,
  to: RegExp,
): Promise<void> {
  const controls = sessionControls(page);
  await expect(async () => {
    if ((await serverSessionStatus(page)) !== target) {
      const button = controls.getByRole("button", { name: from });
      if (await button.isEnabled().catch(() => false)) await button.click();
    }
    expect(await serverSessionStatus(page)).toBe(target);
  }).toPass({ timeout: 20_000 });
  // The console re-reads the session after each control: it follows the server, no reload.
  await expect(controls.getByRole("button", { name: to })).toBeEnabled({ timeout: 15_000 });
}

/**
 * Opens the console on a room the server confirms is live, resuming it first if an earlier test
 * (or an earlier attempt of this one) left it paused. Each test starts from the seeded live room.
 */
async function openLiveConsole(page: Page): Promise<void> {
  await clerkConsole(page);
  await expect
    .poll(() => serverSessionStatus(page), { timeout: 15_000 })
    .toMatch(/^(live|paused)$/);
  if ((await serverSessionStatus(page)) === "paused") {
    await pressUntilServer(page, /^resume$/i, "live", /^pause$/i);
  }
  await expect(sessionControls(page).getByRole("button", { name: /^pause$/i })).toBeEnabled();
}

/**
 * The seed has Room A live with its third lot (Meridian Drift) on the block, so these tests start
 * from a running session. The test that moves the block on runs last: it changes what is on it.
 */
test.describe("hybrid saleroom clerk @journey", () => {
  // The tests share one seeded room (pause, reconnect, advance), so they run one after another.
  test.describe.configure({ mode: "serial" });
  test.skip(!e2eEnabled, skipReason);

  test("staff can open the clerk console for a hybrid sale", async ({ page }) => {
    await openLiveConsole(page);
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
    // Pause is pressed only once the server confirms the room is live.
    await openLiveConsole(page);
    try {
      await pressUntilServer(page, /^pause$/i, "paused", /^resume$/i);
      await expect(sessionControls(page).getByRole("button", { name: /^pause$/i })).toHaveCount(0);
      await pressUntilServer(page, /^resume$/i, "live", /^pause$/i);
    } finally {
      // Leave the room live for the tests that follow, whatever happened above.
      if ((await serverSessionStatus(page)) === "paused") {
        await pressUntilServer(page, /^resume$/i, "live", /^pause$/i);
      }
    }
  });

  test("clerk controls keep working on a console left open across a deploy", async ({ page }) => {
    await openLiveConsole(page);
    // A deploy replaces the build: the server no longer knows the server action ids this page
    // was built with, and Next answers any such POST to the page with 404. Every POST carrying a
    // `Next-Action` header is answered that way from here on.
    const staleActionPosts: string[] = [];
    await page.route(`**/admin/saleroom/${seededHybridSaleId}*`, async (route) => {
      const request = route.request();
      if (request.method() === "POST" && (await request.headerValue("next-action"))) {
        staleActionPosts.push(request.url());
        await route.fulfill({ status: 404, body: "Server action not found." });
        return;
      }
      await route.fallback();
    });

    try {
      await pressUntilServer(page, /^pause$/i, "paused", /^resume$/i);
      await pressUntilServer(page, /^resume$/i, "live", /^pause$/i);
    } finally {
      if ((await serverSessionStatus(page)) === "paused") {
        await page.unroute(`**/admin/saleroom/${seededHybridSaleId}*`);
        await pressUntilServer(page, /^resume$/i, "live", /^pause$/i);
      }
    }

    // The controls went through the API, not the page, and the console never fell over.
    expect(staleActionPosts).toEqual([]);
    await expect(page.getByText(/clerk console did not load/i)).toHaveCount(0);
    await expect(lotOnBlockHeading(page)).toBeVisible();
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

  test("a bid a limit refused says which limit in an alert above the form, not a toast", async ({
    page,
  }) => {
    // The API's answer is mocked at the BFF, so nothing is placed and the room is unchanged.
    const refusedBids: string[] = [];
    await page.route("**/admin/saleroom/telephone-bids", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      refusedBids.push(route.request().postData() ?? "");
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Bid exceeds your approved limit for this sale",
          code: "bid_limit_exceeded",
          refusal: { kind: "registration", limit: "5000.00", available: null },
        }),
      });
    });
    await clerkConsole(page);

    // The seed confirms one telephone line for the lot on the block.
    const telephoneAmount = page.locator('input[id^="telephone-bid-amount-"]');
    await expect(telephoneAmount).toBeVisible();
    await expect(async () => {
      await page.getByRole("combobox", { name: "Telephone line" }).click();
      await page.getByRole("option").first().click({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await page
      .locator("div")
      .filter({ has: telephoneAmount })
      .filter({ has: page.getByRole("button", { name: /^minimum bid/i }) })
      .last()
      .getByRole("button", { name: /^minimum bid/i })
      .click();
    await expect(telephoneAmount).toHaveValue(/^7,?100(\.00)?$/);

    await page.getByRole("button", { name: /^place telephone bid$/i }).click();

    const alert = page.getByRole("alert").filter({ hasText: /wasn't placed/ });
    await expect(alert).toContainText(/bid of £7,100\.00 wasn't placed/);
    await expect(alert).toContainText("Their approved limit for this sale is £5,000.00.");
    await expect(alert).toContainText(
      "Take a bid within the limit. To bid higher, their registration limit must be raised first.",
    );
    // Above the form it concerns (FBK-1).
    const alertTop = (await alert.boundingBox())?.y ?? Number.POSITIVE_INFINITY;
    const amountTop = (await telephoneAmount.boundingBox())?.y ?? 0;
    expect(alertTop).toBeLessThan(amountTop);
    expect(refusedBids).toHaveLength(1);
    // A limit refusal is an answer, not an error: no toast is raised for it.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    await expect(page.getByText("Bid exceeds your approved limit for this sale")).toHaveCount(0);

    // Changing the bid clears it.
    await telephoneAmount.fill("5000");
    await expect(alert).toHaveCount(0);
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
