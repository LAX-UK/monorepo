import { type APIRequestContext, type Page, type Response, expect, test } from "@playwright/test";
import { resolveSaleRoutes } from "./public-routes";

/**
 * Signed-out visitors read a lot's live bid state in the browser through the same-origin BFF
 * (`/api/bff/lots/:id` and `/api/bff/lots/:id/bids`, CO-7). When the BFF answered those reads with
 * 401 the lot page's price block stayed on "Loading the latest bid" for good, while every unit test
 * passed. These checks open the real pages without a session and hold both ends: the live reads are
 * served, and the price block leaves its placeholder for a real price or result.
 */

const enabled = process.env.PLAYWRIGHT_E2E === "1";
const skipReason = "Set PLAYWRIGHT_E2E=1, PLAYWRIGHT_BASE_URL, and start the seeded stack.";
const API =
  process.env.PLAYWRIGHT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Long enough for a cold page's first live read, far shorter than "never". */
const LIVE_READ_TIMEOUT = 15_000;

const PLACEHOLDER = "Loading the latest bid";

type LotRow = { id: string; title?: string | null; status: string };

type Subject = {
  name: "open" | "upcoming" | "ended";
  statuses: readonly string[];
  /** The price block's label once the live read has landed. */
  label: RegExp;
  /** The figure or word under it: a price while bidding can happen, the result once it has ended. */
  value: RegExp;
};

const MONEY = /\d/;

/**
 * The workspace packages load when a test runs, not when Playwright lists the tests: the listing
 * step runs before the packages are built.
 */
const loadTypes = () => import("@auction/types");

const SUBJECTS: readonly Subject[] = [
  {
    name: "open",
    statuses: ["active"],
    label: /^(Current bid|Starting bid)$/,
    value: MONEY,
  },
  {
    name: "upcoming",
    statuses: ["scheduled", "pending"],
    label: /^Starting bid$/,
    value: MONEY,
  },
  {
    name: "ended",
    statuses: ["sold", "unsold", "passed", "ended", "closed"],
    label: /^(Hammer price|Sold for|Result|Estimate|Ended)$/,
    value: /\d|Not sold|Ended/,
  },
];

/** Every public lot the API lists, a few pages deep, so each lifecycle the seed has is found. */
async function listLots(request: APIRequestContext): Promise<LotRow[]> {
  const rows: LotRow[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const res = await request.get(`${API}/lots?limit=50&page=${page}`);
    if (!res.ok()) break;
    const body = (await res.json()) as { data?: LotRow[] };
    const data = body.data ?? [];
    rows.push(...data);
    if (data.length < 50) break;
  }
  return rows;
}

/** A BFF read under `/api/bff/lots/…` (the lot, its bids, its history, its watch count). */
function isBffLotRead(response: Response): boolean {
  return new URL(response.url()).pathname.startsWith("/api/bff/lots/");
}

/** Records every BFF lot read the page makes, from before its first request. */
function recordBffLotReads(page: Page): { url: string; status: number }[] {
  const seen: { url: string; status: number }[] = [];
  page.on("response", (response) => {
    if (isBffLotRead(response)) seen.push({ url: response.url(), status: response.status() });
  });
  return seen;
}

function expectNoUnauthorised(seen: readonly { url: string; status: number }[]) {
  const refused = seen.filter((read) => read.status === 401 || read.status === 403);
  expect(refused, "BFF lot reads refused to a signed-out visitor").toEqual([]);
}

test.describe("lot page, signed out: live bid state @smoke", () => {
  const lotPaths = new Map<Subject["name"], { id: string; path: string }>();

  test.beforeAll(async ({ playwright }) => {
    if (!enabled) return;
    // Once per file: the public API rate-limits, and the lots are the same for every test.
    const request = await playwright.request.newContext();
    const lots = await listLots(request);
    await request.dispose();
    const { lotPath } = await loadTypes();
    for (const subject of SUBJECTS) {
      const lot = lots.find((row) => subject.statuses.includes(row.status));
      // The canonical address, so the page is not replaced by a redirect while it is read.
      if (lot)
        lotPaths.set(subject.name, {
          id: lot.id,
          path: lotPath({ id: lot.id, title: lot.title ?? "" }),
        });
    }
  });

  test.beforeEach(async ({ context }) => {
    test.skip(!enabled, skipReason);
    // Signed out: this project starts without a saved session; make sure nothing leaked in.
    await context.clearCookies();
  });

  for (const subject of SUBJECTS) {
    test(`${subject.name} lot: the price block leaves its placeholder and no lot read is refused`, async ({
      page,
    }) => {
      const lot = lotPaths.get(subject.name);
      test.skip(!lot, `No seeded ${subject.name} lot to open`);
      const lotId = lot?.id ?? "";
      const seen = recordBffLotReads(page);

      const liveRead = page.waitForResponse(
        (response) => new URL(response.url()).pathname === `/api/bff/lots/${lotId}`,
        { timeout: LIVE_READ_TIMEOUT },
      );
      await page.goto(lot?.path ?? "");

      const read = await liveRead;
      expect(read.status(), `GET ${new URL(read.url()).pathname}`).toBe(200);

      const block = page.getByRole("region", { name: "Price and bidding" });
      await expect(block).toBeVisible();
      await expect(block.getByText(PLACEHOLDER)).toHaveCount(0, { timeout: LIVE_READ_TIMEOUT });
      await expect(block).not.toHaveAttribute("aria-busy", "true");

      await expect(block.getByText(subject.label).first()).toBeVisible();
      await expect(block).toContainText(subject.value);

      expect(seen.length, "the page read the lot through the BFF").toBeGreaterThan(0);
      expectNoUnauthorised(seen);
    });
  }
});

test.describe("sale page quick look, signed out: live lot read @smoke", () => {
  let salePath = "";

  test.beforeAll(async ({ playwright }) => {
    if (!enabled) return;
    const request = await playwright.request.newContext();
    const [sale] = await resolveSaleRoutes(request);
    await request.dispose();
    salePath = sale?.path ?? "";
  });

  test.beforeEach(async ({ context }) => {
    test.skip(!enabled, skipReason);
    test.skip(!salePath, "No seeded sale to open");
    await context.clearCookies();
  });

  test("desktop hover: quick look opens and its lot read is served", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const seen = recordBffLotReads(page);
    await page.goto(`${salePath}?view=grid`);

    const card = page.getByTestId("lot-card").first();
    await expect(card).toBeVisible();
    await card.hover();
    const trigger = card.getByRole("button", { name: /^Quick look at / });
    await expect(trigger).toBeVisible();

    const lotRead = page.waitForResponse(
      (response) => /^\/api\/bff\/lots\/[^/]+$/.test(new URL(response.url()).pathname),
      { timeout: LIVE_READ_TIMEOUT },
    );
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "View lot" })).toBeVisible();

    const read = await lotRead;
    expect(read.status(), `GET ${new URL(read.url()).pathname}`).toBe(200);
    expectNoUnauthorised(seen);
  });
});
