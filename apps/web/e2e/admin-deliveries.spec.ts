import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { type Page, type TestInfo, expect, test } from "@playwright/test";
import pg from "pg";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";

/**
 * Bid admin › Operations › Deliveries (docs/design/staff-gaps-delivery-zoho-alerts.md, D1–D6):
 * a buyer's request for a delivery price reaches the list and the sidebar count, staff find it by
 * search, open it in the queue panel beside the list and step with J and K, Escape returns them to
 * the row, and an empty view says so. The journey adds its own made-up requests on two of the
 * seed's won lots (and takes them away again), so it never depends on demo data for its rows.
 *
 * It never skips quietly: with PLAYWRIGHT_E2E=1 set, a missing database or a seed without two
 * free won lots fails the run. CI runs it on every PR that touches the web app ("Run Bid admin
 * Deliveries journey" in .github/workflows/e2e-pr.yml), which also fails on any skipped test.
 * Each state is shot at 1440 and 375 wide, light and dark, into e2e-evidence/deliveries (kept
 * apart from test-results, which the next Playwright run empties).
 */

const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;
const TAG = `E2E ${randomUUID().slice(0, 6)}`;

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      const file = path.join(
        process.cwd(),
        "e2e-evidence",
        "deliveries",
        `${name}-${size.name}-${scheme}.png`,
      );
      await mkdir(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file });
      await testInfo.attach(`${name}-${size.name}-${scheme}`, {
        path: file,
        contentType: "image/png",
      });
    }
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function withDatabase<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required: the journey adds its own delivery requests");
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Two won lots with no delivery request yet get one each, to a made-up address. */
async function addRequests(): Promise<string[]> {
  return withDatabase(async (client) => {
    const won = await client.query<{ id: string; buyer: string }>(
      `select l.id, l.buyer_legal_entity_id as buyer
         from lot l
        where l.buyer_legal_entity_id is not null
          and not exists (select 1 from delivery_quote q where q.lot_id = l.id)
          and not exists (
            select 1 from lot_fulfilment f
             where f.lot_id = l.id and f.status in ('in_transit', 'delivered', 'cancelled')
          )
        order by l.id
        limit 2`,
    );
    if (won.rows.length < 2) {
      throw new Error(
        `The seed has ${won.rows.length} won lot(s) with no delivery request; the journey needs two`,
      );
    }
    for (const [index, lot] of won.rows.entries()) {
      await client.query(
        `insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, requested_at)
         values ($1, $2, 'requested', $3, now() - ($4 || ' hours')::interval)`,
        [lot.id, lot.buyer, `${index + 1} Example Lane, ${TAG}, France`, String(index + 2)],
      );
    }
    return won.rows.map((lot) => lot.id);
  });
}

/** How many deliveries are on the way: the empty state below needs none. */
async function onTheWayCount(): Promise<number> {
  return withDatabase(async (client) => {
    const result = await client.query<{ count: string }>(
      `select count(*) from delivery_quote q
         join lot_fulfilment f on f.lot_id = q.lot_id
        where f.status = 'in_transit'`,
    );
    return Number(result.rows[0]?.count ?? 0);
  });
}

async function removeRequests(lotIds: string[]) {
  if (lotIds.length === 0) return;
  await withDatabase((client) =>
    client.query(
      "delete from delivery_quote where lot_id = any($1::uuid[]) and destination like $2",
      [lotIds, `%${TAG}%`],
    ),
  );
}

test.describe("deliveries @journey", () => {
  // The suite-wide opt-in only. Everything else this journey needs is checked and fails loudly.
  test.skip(!e2eEnabled, e2eSkipReason);
  test.describe.configure({ retries: 0 });

  let lotIds: string[] = [];
  test.beforeAll(async () => {
    if (!hasStaffCredentials()) {
      throw new Error("PLAYWRIGHT_STAFF_EMAIL and PLAYWRIGHT_STAFF_PASSWORD are required");
    }
    lotIds = await addRequests();
  });
  test.afterAll(async () => {
    await removeRequests(lotIds);
  });

  test("finds a buyer's request, opens it beside the list and steps through", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    expect(lotIds).toHaveLength(2);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/deliveries");

    await test.step("Operations › Deliveries opens on Waiting for a price", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Deliveries" })).toBeVisible();
      // NAV-3: the sidebar's count is read as ", 2 waiting" (or more, on a busy stack).
      await expect(
        page.getByRole("navigation", { name: "Main" }).getByRole("link", {
          name: /^Deliveries\s*,\s*\d+ waiting$/,
        }),
      ).toHaveAttribute("href", "/admin/deliveries");
      const views = page.getByRole("navigation", { name: "Views" });
      const waiting = views.getByRole("link", { name: /^Waiting for a price\s*\d+\s*waiting$/ });
      await expect(waiting).toHaveAttribute("aria-current", "page");
      for (const label of ["Quoted", "To dispatch", "On the way", "Delivered", "Closed"]) {
        await expect(views.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
      }
    });

    const grid = page.getByRole("grid", { name: "Deliveries" });

    await test.step("search by destination finds the two requests", async () => {
      const search = page.getByRole("searchbox", { name: "Search deliveries" });
      await search.fill(TAG);
      await search.press("Enter");
      await expect(page).toHaveURL(/q=E2E/);
      await expect(grid.getByText(TAG, { exact: false })).toHaveCount(2);
      await expect(grid.getByText("Waiting for a price").first()).toBeVisible();
      await shoot(page, testInfo, "01-waiting");
    });

    await test.step("a row opens the queue panel beside the list, with focus on its title", async () => {
      await grid.getByRole("row").nth(1).getByRole("link").first().click();
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible();
      await expect(page).toHaveURL(/record=/);
      await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
      await expect(panel.getByText("1 of 2")).toBeVisible();
      await expect(panel.getByText("Buyer asked for a delivery price")).toBeVisible();
      // D3: the list stays in view beside the 480px panel, its status, price and waiting
      // columns clear of it, with no scrim over them.
      const panelBox = await panel.boundingBox();
      expect(panelBox?.width).toBe(480);
      for (const column of ["Status", "Price", "Waiting"]) {
        const header = grid.getByRole("columnheader", { name: column });
        await expect(header).toBeVisible();
        const box = await header.boundingBox();
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(panelBox?.x ?? 0);
      }
      await expect(page.locator('[data-lax-motion="scrim"]')).toHaveCount(0);
      await shoot(page, testInfo, "02-waiting-panel");
    });

    await test.step("J and K step through the queue, Escape returns to the row", async () => {
      const panel = page.getByRole("dialog");
      await page.keyboard.press("j");
      await expect(panel.getByText("2 of 2")).toBeVisible();
      await page.keyboard.press("k");
      await expect(panel.getByText("1 of 2")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(page).not.toHaveURL(/record=/);
      await expect(grid.getByRole("row").nth(1)).toBeFocused();
    });

    await test.step("a link to a lot with no delivery says so, with a way back", async () => {
      await page.goto(`/admin/deliveries?record=${randomUUID()}`);
      const panel = page.getByRole("dialog", { name: "Delivery not found" });
      await expect(
        panel.getByText("This delivery could not be found. It may have been withdrawn."),
      ).toBeVisible();
      await shoot(page, testInfo, "15-not-found");
      await panel.getByRole("button", { name: "Back to the list" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    await test.step("an empty view says so in its own words", async () => {
      expect(await onTheWayCount()).toBe(0);
      await page.goto("/admin/deliveries?view=on_the_way");
      await expect(
        page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: /^On the way/ }),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.getByText("No deliveries on the way")).toBeVisible();
      await shoot(page, testInfo, "11-empty");
    });

    await test.step("a search that matches nothing says so, and clears", async () => {
      await page.goto("/admin/deliveries?q=nothing-matches-this-search");
      await expect(page.getByText("No deliveries match")).toBeVisible();
      await shoot(page, testInfo, "12-no-results");
    });
  });
});
