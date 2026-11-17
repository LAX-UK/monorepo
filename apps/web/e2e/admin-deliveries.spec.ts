import { randomUUID } from "node:crypto";
import { type Page, type TestInfo, expect, test } from "@playwright/test";
import pg from "pg";
import { e2eEnabled, e2eSkipReason, hasStaffCredentials } from "./helpers/auth";
import { shoot } from "./helpers/collection-journeys";

/**
 * Bid admin › Operations › Deliveries (docs/design/staff-gaps-delivery-zoho-alerts.md, D1–D6):
 * a buyer's request for a delivery price reaches the list, staff find it by search, open it in
 * the queue panel and step with J and K, and every view tab answers. The journey adds its own
 * made-up requests on won lots (and takes them away again), so it never depends on demo data.
 * Each state is shot at 1440 and 375 wide, light and dark.
 */

const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;
const TAG = `E2E ${randomUUID().slice(0, 6)}`;

async function shootAll(page: Page, testInfo: TestInfo, name: string) {
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await shoot(page, testInfo, `deliveries-${name}-${size.name}-${scheme}`);
    }
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

/** Two won lots with no delivery request yet get one each, to a made-up address. */
async function addRequests(): Promise<string[]> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
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
    for (const [index, lot] of won.rows.entries()) {
      await client.query(
        `insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, requested_at)
         values ($1, $2, 'requested', $3, now() - ($4 || ' hours')::interval)`,
        [lot.id, lot.buyer, `${index + 1} Example Lane, ${TAG}, France`, String(index + 2)],
      );
    }
    return won.rows.map((lot) => lot.id);
  } finally {
    await client.end();
  }
}

async function removeRequests(lotIds: string[]) {
  if (lotIds.length === 0) return;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      "delete from delivery_quote where lot_id = any($1::uuid[]) and destination like $2",
      [lotIds, `%${TAG}%`],
    );
  } finally {
    await client.end();
  }
}

test.describe("deliveries @journey", () => {
  test.skip(!e2eEnabled || !hasStaffCredentials(), e2eSkipReason);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is needed to add the journey's requests");
  test.describe.configure({ retries: 0 });

  let lotIds: string[] = [];
  test.beforeAll(async () => {
    lotIds = await addRequests();
  });
  test.afterAll(async () => {
    await removeRequests(lotIds);
  });

  test("finds a buyer's request, opens it in the queue panel and steps through", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(lotIds.length < 2, "the seed has fewer than two won lots without a delivery");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/admin/deliveries");

    await test.step("Operations › Deliveries opens on Waiting for a price", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Deliveries" })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Deliveries/ }).first()).toHaveAttribute(
        "href",
        "/admin/deliveries",
      );
      const views = page.getByRole("navigation", { name: "Views" });
      await expect(views.getByRole("link", { name: /Waiting for a price/ })).toHaveAttribute(
        "aria-current",
        "page",
      );
      for (const label of ["Quoted", "To dispatch", "On the way", "Delivered", "Closed"]) {
        await expect(views.getByRole("link", { name: new RegExp(label) })).toBeVisible();
      }
    });

    await test.step("search by destination finds the two requests", async () => {
      const search = page.getByRole("searchbox", { name: "Search deliveries" });
      await search.fill(TAG);
      await search.press("Enter");
      await expect(page).toHaveURL(/q=E2E/);
      const grid = page.getByRole("grid", { name: "Deliveries" });
      await expect(grid.getByText(TAG, { exact: false })).toHaveCount(2);
      await expect(grid.getByText("Waiting for a price").first()).toBeVisible();
      await shootAll(page, testInfo, "1-waiting");
    });

    await test.step("a row opens the queue panel, J and K step, Escape closes", async () => {
      const grid = page.getByRole("grid", { name: "Deliveries" });
      await grid.getByRole("row").nth(1).getByRole("link").first().click();
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible();
      await expect(page).toHaveURL(/record=/);
      await expect(panel.getByText("1 of 2")).toBeVisible();
      await expect(panel.getByText("Buyer asked for a delivery price")).toBeVisible();
      await shootAll(page, testInfo, "2-panel");
      await page.keyboard.press("j");
      await expect(panel.getByText("2 of 2")).toBeVisible();
      await page.keyboard.press("k");
      await expect(panel.getByText("1 of 2")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
    });

    await test.step("every view answers, and an empty one says so", async () => {
      await page.goto(`/admin/deliveries?view=closed&q=${encodeURIComponent(TAG)}`);
      await expect(
        page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: /Closed/ }),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.getByText("No deliveries match")).toBeVisible();
      await page.goto("/admin/deliveries?q=nothing-matches-this-search");
      await expect(page.getByText("No deliveries match")).toBeVisible();
      await shootAll(page, testInfo, "3-no-results");
    });
  });
});
