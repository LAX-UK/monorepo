import { type Locator, type Page, expect } from "@playwright/test";
import pg from "pg";
import { clientSession } from "./helpers/auth";
import { test } from "./helpers/test";
import { resolveArtistRoutes, resolveSaleRoutes } from "./public-routes";

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start apps/web (pnpm dev).";

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

/** The lot page with its bid dialog open, as the card's "Leave a bid" links it. */
function withBidOpen(href: string | null): string {
  return `${href}${href?.includes("?") ? "&" : "?"}bid=open`;
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

/** The seeded open online sale (organisation journeys), copied for a sale that has not opened. */
const SEEDED_ONLINE_SALE = "e1000010-0000-4000-8000-000000000010";
const SCHEDULED_SALE = "e1000099-0000-4000-8000-000000000099";
const SCHEDULED_LOT = "b1000999-0000-4000-8000-000000000999";
const ONSITE_SALE = "e1000098-0000-4000-8000-000000000098";
const ONSITE_LOT = "b1000998-0000-4000-8000-000000000998";
type ScheduledFixture = {
  saleId: string;
  lotId: string;
  deliveryMode: "online" | "onsite";
};
const ONLINE_FIXTURE: ScheduledFixture = {
  saleId: SCHEDULED_SALE,
  lotId: SCHEDULED_LOT,
  deliveryMode: "online",
};
const ONSITE_FIXTURE: ScheduledFixture = {
  saleId: ONSITE_SALE,
  lotId: ONSITE_LOT,
  deliveryMode: "onsite",
};

/**
 * An online sale that opens tomorrow, with one lot: its card's button depends on who is looking
 * ("Register to bid" for a visitor, "Leave a bid" for a registered collector), unlike an open
 * lot's "Bid". The seed has no such sale, so this copies the seeded open online sale and one of its
 * lots under new ids with tomorrow's times, and removes them afterwards. It is a sale of its own,
 * so no other spec's sale or lot changes. Needs `DATABASE_URL` (the e2e stack's database).
 */
async function withScheduledSale(
  fixture: ScheduledFixture,
): Promise<{ path: string; remove: () => Promise<void> }> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return { path: "", remove: async () => {} };
  const client = new pg.Client({ connectionString });
  await client.connect();
  const remove = async () => {
    await client.query("delete from lot where id = $1", [fixture.lotId]);
    await client.query("delete from sale where id = $1", [fixture.saleId]);
  };
  await remove();
  await client.query("begin");
  await client.query(
    "create temp table e2e_sale on commit drop as select * from sale where id = $1",
    [SEEDED_ONLINE_SALE],
  );
  await client.query(
    `update e2e_sale set id = $1, title = 'Lot card e2e: opens tomorrow (${fixture.deliveryMode})', status = 'scheduled',
       start_time = now() + interval '1 day', end_time = now() + interval '8 days',
       preview_start_time = now() - interval '1 day', home_pin_order = null,
       delivery_mode = '${fixture.deliveryMode}'`,
    [fixture.saleId],
  );
  await client.query("insert into sale select * from e2e_sale");
  await client.query(
    "create temp table e2e_lot on commit drop as select * from lot where sale_id = $1 and lot_number = 1",
    [SEEDED_ONLINE_SALE],
  );
  await client.query(
    `update e2e_lot set id = $1, sale_id = $2, status = 'scheduled', artwork_register_id = null,
       start_time = now() + interval '1 day', end_time = now() + interval '8 days',
       current_price = starting_price, winner_id = null, buyer_legal_entity_id = null`,
    [fixture.lotId, fixture.saleId],
  );
  await client.query("insert into lot select * from e2e_lot");
  await client.query("commit");
  return {
    path: `/sales/sale/${fixture.saleId}`,
    remove: async () => {
      await remove();
      await client.end();
    },
  };
}

let salePath = "";
let artistPath = "";
let scheduledSalePath = "";
let onsiteSalePath = "";
let removeScheduledSale: () => Promise<void> = async () => {};
let removeOnsiteSale: () => Promise<void> = async () => {};

test.beforeAll(async ({ playwright }) => {
  if (!enabled) return;
  const request = await playwright.request.newContext();
  const [sale] = await resolveSaleRoutes(request);
  const artist = (await resolveArtistRoutes(request)).find((r) => r.name === "artist-on-sale");
  salePath = sale?.path ?? "";
  artistPath = artist?.path ?? "";
  await request.dispose();
  const scheduled = await withScheduledSale(ONLINE_FIXTURE);
  scheduledSalePath = scheduled.path;
  removeScheduledSale = scheduled.remove;
  const onsite = await withScheduledSale(ONSITE_FIXTURE);
  onsiteSalePath = onsite.path;
  removeOnsiteSale = onsite.remove;
});

test.afterAll(async () => {
  await removeScheduledSale();
  await removeOnsiteSale();
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
    const hovered = await box.boundingBox();
    const label = await quickLook.boundingBox();
    const hoveredBottom = (hovered?.y ?? 0) + (hovered?.height ?? 0);
    expect(label?.y ?? 0).toBeGreaterThan(hovered?.y ?? 0);
    expect(hoveredBottom - ((label?.y ?? 0) + (label?.height ?? 0))).toBeGreaterThanOrEqual(38);

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
        if (label === "Leave a bid") expect(href).toBe(withBidOpen(pictureHref));
        if (label !== "Bid" && label !== "Leave a bid") expect(href).not.toBe(pictureHref);
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

test.describe("lot card button before the lot opens @smoke", () => {
  test.beforeEach(() => {
    test.skip(!scheduledSalePath, "Set DATABASE_URL (the e2e stack's database)");
  });

  /** The first card whose lot has not opened: no "Bid" there, whoever is looking. */
  async function notYetOpen(page: Page): Promise<Locator> {
    // After signing in, My bids may still be settling its own address; a navigation it
    // interrupts is simply made again.
    await page.goto(`${scheduledSalePath}?view=grid`).catch(async () => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.goto(`${scheduledSalePath}?view=grid`);
    });
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
    expect(await button.getAttribute("href")).toBe(withBidOpen(pictureHref));
  });
});

test.describe("scheduled onsite sale: no card button is possible, so nothing is drawn @smoke", () => {
  test("no action slot or skeleton at any moment", async ({ page }) => {
    test.skip(!onsiteSalePath, "Set DATABASE_URL (the e2e stack's database)");
    // Watch every card from the first frame: a skeleton or action slot that shows and is then
    // removed is a layout shift of the whole row below it.
    await page.addInitScript(() => {
      const w = window as unknown as { __slotSeen: number };
      w.__slotSeen = 0;
      const look = () => {
        if (document.querySelector("[data-testid='lot-card-action']")) w.__slotSeen += 1;
      };
      new MutationObserver(look).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`${onsiteSalePath}?view=grid`);
    await expect(lotCards(page).first()).toBeVisible();
    await settled(page);
    await page.waitForTimeout(1000);
    expect(await page.locator("[data-testid='lot-card-action']").count()).toBe(0);
    const seen = await page.evaluate(
      () => (window as unknown as { __slotSeen: number }).__slotSeen,
    );
    expect(seen).toBe(0);
  });
});
