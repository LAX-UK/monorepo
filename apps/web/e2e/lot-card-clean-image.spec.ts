import { type APIRequestContext, type Locator, type Page, expect } from "@playwright/test";
import { clientSession } from "./helpers/auth";
import { test } from "./helpers/test";
import { resolveArtistRoutes, resolveSaleRoutes } from "./public-routes";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

const apiBase = () =>
  process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** The labels a lot card's full-width button may carry; each names what the button does. */
const CARD_BUTTON_LABELS = [
  "Bid",
  "Leave a bid",
  "Register to bid",
  "Verify identity to bid",
  "Set up a buyer profile",
];

/** Every lot card on the page: there is one lot card component (components/lot-card/lot-card.tsx). */
function lotCards(page: Page): Locator {
  return page.getByTestId("lot-card");
}

/** A card's picture box: the picture link, the status pill and the owner badge, nothing else. */
function pictureBox(card: Locator): Locator {
  return card.getByTestId("lot-card-media");
}

/** The card's full-width button: the link in its action slot (never the bidder's "Bid £X"). */
function cardButton(card: Locator): Locator {
  return card.getByTestId("lot-card-action").getByRole("link");
}

async function opacity(locator: Locator): Promise<number> {
  return locator.evaluate((el) => Number(getComputedStyle(el).opacity));
}

/** Waits until the cards' live and viewer reads have settled (no placeholder left). */
async function settled(page: Page) {
  await expect(page.locator("[data-testid='lot-card'] [aria-busy='true']")).toHaveCount(0, {
    timeout: 15_000,
  });
}

type SaleRow = { sale: { id: string; status: string; deliveryMode: string } };
type LotRow = { id: string; status: string; saleId: string | null };

async function listJson<T>(request: APIRequestContext, path: string): Promise<T[]> {
  const res = await request.get(`${apiBase()}${path}`);
  if (!res.ok()) return [];
  const body = (await res.json()) as { data?: T[] };
  return body.data ?? [];
}

/**
 * An online sale that has not opened, with a lot that has not opened either: its cards' button
 * depends on who is looking ("Register to bid" for a visitor, "Leave a bid" for a registered
 * collector), unlike an open lot's "Bid".
 */
async function scheduledOnlineSale(request: APIRequestContext): Promise<string> {
  const sales = await listJson<SaleRow>(request, "/sales?limit=50");
  const lots = await listJson<LotRow>(request, "/lots?limit=100");
  const found = sales.find(
    (row) =>
      row.sale.status === "scheduled" &&
      row.sale.deliveryMode === "online" &&
      lots.some((lot) => lot.saleId === row.sale.id && lot.status === "scheduled"),
  );
  return found ? `/sales/sale/${found.sale.id}` : "";
}

let salePath = "";
let artistPath = "";
let scheduledSalePath = "";

test.beforeAll(async ({ playwright }) => {
  if (!enabled) return;
  const request = await playwright.request.newContext();
  const [sale] = await resolveSaleRoutes(request);
  const artist = (await resolveArtistRoutes(request)).find((r) => r.name === "artist-on-sale");
  salePath = sale?.path ?? "";
  artistPath = artist?.path ?? "";
  scheduledSalePath = await scheduledOnlineSale(request);
  await request.dispose();
});

test.beforeEach(async ({ page }) => {
  test.skip(!enabled, skipReason);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("lot grids: one lot card, nothing on the picture @smoke", () => {
  test("no lot grid puts a watchlist button (or any control) inside a card's picture", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    test.skip(!salePath || !artistPath, "No seeded sale or artist with works to open");
    await page.setViewportSize({ width: 1440, height: 900 });
    const grids = [
      "/",
      "/search?view=grid",
      "/search?view=card",
      `${salePath}?view=grid`,
      artistPath,
    ];
    for (const path of grids) {
      await page.goto(path);
      const cards = lotCards(page);
      await expect(cards.first(), `${path} shows lot cards`).toBeVisible();
      await settled(page);
      // No control at all sits in a picture box: not the heart, not quick look.
      const inPicture = page.locator("[data-testid='lot-card-media'] button");
      expect(await inPicture.count(), `${path}: controls on a picture`).toBe(0);
      // And, whatever draws a lot grid, no save heart overlaps a lot's picture.
      const overlaps = await page.evaluate(() => {
        const hearts = [...document.querySelectorAll("button")].filter((b) =>
          /watchlist/i.test(b.getAttribute("aria-label") ?? ""),
        );
        const pictures = [...document.querySelectorAll("img")]
          .map((img) => img.getBoundingClientRect())
          .filter((r) => r.width > 40 && r.height > 40);
        return hearts.filter((heart) => {
          const h = heart.getBoundingClientRect();
          return pictures.some(
            (p) => h.left < p.right && h.right > p.left && h.top < p.bottom && h.bottom > p.top,
          );
        }).length;
      });
      expect(overlaps, `${path}: hearts on a picture`).toBe(0);
      // Each watchable card's heart is on its "Lot N" line.
      const hearts = cards.getByRole("button", { name: /watchlist/ });
      for (const heart of await hearts.all()) {
        await expect(
          heart.locator("xpath=ancestor::*[@data-testid='lot-card-lot-line']"),
        ).toHaveCount(1);
      }
    }
  });
});

test.describe("sale page lot card: clean picture @smoke", () => {
  test.beforeEach(() => {
    test.skip(!salePath, "No seeded sale to open");
  });

  test("desktop: heart on the Lot line; quick look on hover and focus, clear of the pill row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${salePath}?view=grid`);
    const card = lotCards(page).first();
    await expect(card).toBeVisible();
    await page.mouse.move(0, 0);

    // At rest no control is seen: the quick look label is there but unseen.
    const quickLook = card.getByRole("button", { name: /^Quick look at / });
    await expect(quickLook).toHaveCount(1);
    await expect.poll(() => opacity(quickLook)).toBe(0);
    const box = pictureBox(card);
    await expect(box.getByRole("button")).toHaveCount(0);

    // The save heart sits on the "Lot N" line, under the picture, with a 44px tap area.
    const heart = card.getByTestId("lot-card-lot-line").getByRole("button", { name: /watchlist/ });
    await expect(heart).toBeVisible();
    const heartBox = await heart.boundingBox();
    expect(heartBox?.width).toBeGreaterThanOrEqual(44);
    expect(heartBox?.height).toBeGreaterThanOrEqual(44);
    const picture = await box.boundingBox();
    const pictureBottom = (picture?.y ?? 0) + (picture?.height ?? 0);
    expect(heartBox?.y ?? 0).toBeGreaterThanOrEqual(pictureBottom - 1);

    // Mouse over the card: the label shows, over the picture, raised clear of the pill's row.
    await card.hover();
    await expect.poll(() => opacity(quickLook)).toBe(1);
    const label = await quickLook.boundingBox();
    expect(label?.y ?? 0).toBeGreaterThan(picture?.y ?? 0);
    expect(pictureBottom - ((label?.y ?? 0) + (label?.height ?? 0))).toBeGreaterThanOrEqual(38);

    // Keyboard: Tab from the title reaches the label (read after the lot's name), which shows
    // and opens quick look.
    await page.mouse.move(0, 0);
    await card.getByRole("heading").getByRole("link").focus();
    await page.keyboard.press("Tab");
    await expect(quickLook).toBeFocused();
    await expect.poll(() => opacity(quickLook)).toBe(1);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("phone: no quick look trigger, and a tap on the picture opens the lot page", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(`${salePath}?view=grid`);
    const card = lotCards(page).first();
    await expect(card).toBeVisible();
    await expect(page.getByRole("button", { name: /^Quick look at / })).toHaveCount(0);
    await expect(card.getByTestId("lot-card-lot-line").getByRole("button")).toHaveCount(1);

    const picture = pictureBox(card).locator("a").first();
    const href = await picture.getAttribute("href");
    await picture.tap();
    await page.waitForURL((url) => url.pathname === new URL(href ?? "", page.url()).pathname);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await context.close();
  });

  test("every card button names what it does, and goes where its label says", async ({ page }) => {
    await page.goto(`${salePath}?view=grid`);
    const cards = lotCards(page);
    await expect(cards.first()).toBeVisible();
    await settled(page);
    let seen = 0;
    for (const card of await cards.all()) {
      const pictureHref = await pictureBox(card).locator("a").first().getAttribute("href");
      for (const button of await cardButton(card).all()) {
        const label = (await button.innerText()).trim();
        expect(CARD_BUTTON_LABELS).toContain(label);
        const href = (await button.getAttribute("href")) ?? "";
        if (label === "Bid") expect(href).toBe(pictureHref);
        if (label === "Leave a bid") expect(href).toBe(`${pictureHref}?bid=open`);
        if (label !== "Bid" && label !== "Leave a bid") expect(href).not.toBe(pictureHref);
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

test.describe("lot card button before the lot opens @smoke", () => {
  test.beforeEach(() => {
    test.skip(!scheduledSalePath, "No seeded online sale with a lot that has not opened");
  });

  /** The first card whose lot has not opened: no "Bid" there, whoever is looking. */
  async function notYetOpen(page: Page): Promise<Locator> {
    await page.goto(`${scheduledSalePath}?view=grid`);
    await expect(lotCards(page).first()).toBeVisible();
    await settled(page);
    return lotCards(page).first();
  }

  test("a visitor is asked to register, as the hero asks", async ({ page }) => {
    const card = await notYetOpen(page);
    const button = cardButton(card);
    await expect(button).toHaveText("Register to bid");
    // The same step, from the same presenter, as the sale's own register button.
    await expect(
      page.locator("#sale-hero-actions").getByRole("link", { name: "Register to bid" }),
    ).toBeVisible();
    expect(await button.getAttribute("href")).not.toContain("bid=open");
  });

  test("a collector with nothing left to do leaves a bid, on the lot page's dialog", async ({
    page,
  }) => {
    await clientSession(page);
    const card = await notYetOpen(page);
    const button = cardButton(card);
    await expect(button).toHaveText("Leave a bid");
    const pictureHref = await pictureBox(card).locator("a").first().getAttribute("href");
    expect(await button.getAttribute("href")).toBe(`${pictureHref}?bid=open`);
  });
});
