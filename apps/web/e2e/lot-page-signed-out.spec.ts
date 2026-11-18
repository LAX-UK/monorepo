import {
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type Response,
  expect,
  test,
} from "@playwright/test";
import pg from "pg";
import { resolveSaleRoutes } from "./public-routes";

/**
 * Signed-out visitors read a lot's live bid state in the browser through the same-origin BFF
 * (`/api/bff/lots/:id` and `/api/bff/lots/:id/bids`, CO-7). When the BFF answered those reads with
 * 401 the lot page's price block stayed on "Loading the latest bid" for good, while every unit test
 * passed. These checks open the real pages without a session and hold both ends: the live reads are
 * served, and the price block leaves its placeholder for a real price or result.
 *
 * A visitor with no cookies at all is read anonymously either way. The 401 came for signed-out
 * visitors whose browser still carries a Bid session cookie the BFF cannot use: a sign-in they
 * started and left, or a session that has ended. Each check runs for all three.
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
  /** The lot status the API lists it under. */
  status: "active" | "scheduled" | "ended";
  /** The price block's label once the live read has landed. */
  label: RegExp;
  /** The figure or word under it: a price while bidding can happen, the result once it has ended. */
  value: RegExp;
};

const MONEY = /\d/;

const SUBJECTS: readonly Subject[] = [
  { name: "open", status: "active", label: /^(Current bid|Starting bid)$/, value: MONEY },
  { name: "upcoming", status: "scheduled", label: /^Starting bid$/, value: MONEY },
  {
    name: "ended",
    status: "ended",
    label: /^(Hammer price|Sold for|Result)$/,
    value: /\d|Not sold|Ended/,
  },
];

/**
 * The workspace packages load when a test runs, not when Playwright lists the tests: the listing
 * step runs before the packages are built.
 */
const loadTypes = () => import("@auction/types");

/** The seeded open online sale (organisation journeys), copied for a sale that has not opened. */
const SEEDED_ONLINE_SALE = "e1000010-0000-4000-8000-000000000010";
const UPCOMING_SALE = "e1000097-0000-4000-8000-000000000097";
const UPCOMING_LOT = "b1000997-0000-4000-8000-000000000997";

/**
 * An online sale that opens tomorrow, with one lot. The demo seed has no lot that has not opened,
 * so this copies the seeded open online sale and its first lot under new ids with tomorrow's times,
 * and removes them afterwards; no other spec's sale or lot changes. Needs `DATABASE_URL` (the e2e
 * stack's database); without it the upcoming check uses a scheduled lot the API lists, if any.
 */
async function withUpcomingLot(): Promise<{ lot: LotRow | null; remove: () => Promise<void> }> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return { lot: null, remove: async () => {} };
  const client = new pg.Client({ connectionString });
  await client.connect();
  const remove = async () => {
    await client.query("delete from lot where id = $1", [UPCOMING_LOT]);
    await client.query("delete from sale where id = $1", [UPCOMING_SALE]);
  };
  await remove();
  await client.query("begin");
  await client.query(
    "create temp table e2e_sale on commit drop as select * from sale where id = $1",
    [SEEDED_ONLINE_SALE],
  );
  await client.query(
    `update e2e_sale set id = $1, title = 'Lot page e2e: opens tomorrow', status = 'scheduled',
       start_time = now() + interval '1 day', end_time = now() + interval '8 days',
       preview_start_time = now() - interval '1 day', home_pin_order = null`,
    [UPCOMING_SALE],
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
    [UPCOMING_LOT, UPCOMING_SALE],
  );
  await client.query("insert into lot select * from e2e_lot");
  const { rows } = await client.query<{ title: string | null }>(
    "select title from lot where id = $1",
    [UPCOMING_LOT],
  );
  await client.query("commit");
  return {
    lot: { id: UPCOMING_LOT, title: rows[0]?.title ?? "", status: "scheduled" },
    remove: async () => {
      await remove();
      await client.end();
    },
  };
}

/** The first lot the public API lists under a status, as a signed-out visitor sees it. */
async function firstLotWithStatus(
  request: APIRequestContext,
  status: Subject["status"],
): Promise<LotRow | null> {
  const res = await request.get(`${API}/lots?limit=1&status=${status}`);
  if (!res.ok()) return null;
  const body = (await res.json()) as { data?: LotRow[] };
  return body.data?.[0] ?? null;
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

/** The Bid session cookie's name on a stack served over http (`ALLOW_HTTP_COOKIES`). */
const BID_SESSION_COOKIE = "lax-bid-session";

type Visitor = {
  name: string;
  /** Leaves the context in this visitor's signed-out state. */
  prepare: (context: BrowserContext) => Promise<void>;
};

const VISITORS: readonly Visitor[] = [
  { name: "no cookies", prepare: async () => {} },
  {
    // Sign in pressed, the sign-in page left: the BFF holds a session that is still logging in.
    name: "an unfinished sign-in",
    prepare: async (context) => {
      const res = await context.request.get("/api/auth/login?next=/", { maxRedirects: 0 });
      expect(res.status(), "starting a sign-in redirects to the issuer").toBe(302);
      const cookies = await context.cookies();
      expect(
        cookies.some((cookie) => cookie.name === BID_SESSION_COOKIE),
        "starting a sign-in leaves a Bid session cookie",
      ).toBe(true);
    },
  },
  {
    // A session that has ended (expired, or signed out elsewhere) whose cookie is still sent.
    name: "an expired session",
    prepare: async (context) => {
      const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
      await context.addCookies([
        {
          name: BID_SESSION_COOKIE,
          // The shape of a real session id (32 random bytes, base64url) that the BFF does not hold.
          value: "e2e-ended-session-0000000000000000000000000",
          url: baseURL,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    },
  },
];

test.describe("lot page, signed out: live bid state @smoke", () => {
  const lotPaths = new Map<Subject["name"], { id: string; path: string }>();
  let removeUpcomingLot: () => Promise<void> = async () => {};

  test.beforeAll(async ({ playwright }) => {
    if (!enabled) return;
    // Once per file: the public API rate-limits, and the lots are the same for every test.
    const request = await playwright.request.newContext();
    const { lotPath } = await loadTypes();
    for (const subject of SUBJECTS) {
      let lot: LotRow | null = null;
      if (subject.status === "scheduled" && process.env.DATABASE_URL) {
        // The fixture first clears any copy a stopped run left behind, so it is always fresh.
        const upcoming = await withUpcomingLot();
        removeUpcomingLot = upcoming.remove;
        lot = upcoming.lot;
      } else {
        lot = await firstLotWithStatus(request, subject.status);
      }
      // The canonical address, so the page is not replaced by a redirect while it is read.
      if (lot) {
        lotPaths.set(subject.name, {
          id: lot.id,
          path: lotPath({ id: lot.id, title: lot.title ?? "" }),
        });
      }
    }
    await request.dispose();
  });

  test.afterAll(async () => {
    await removeUpcomingLot();
  });

  test.beforeEach(async ({ context }) => {
    test.skip(!enabled, skipReason);
    // This project starts without a saved session; make sure nothing leaked in.
    await context.clearCookies();
  });

  for (const subject of SUBJECTS) {
    for (const visitor of VISITORS) {
      test(`${subject.name} lot, ${visitor.name}: the price block leaves its placeholder and no lot read is refused`, async ({
        context,
        page,
      }) => {
        const lot = lotPaths.get(subject.name);
        test.skip(!lot, `No seeded ${subject.name} lot to open`);
        const lotId = lot?.id ?? "";
        await visitor.prepare(context);
        const seen = recordBffLotReads(page);

        const liveRead = page.waitForResponse(
          (response) => new URL(response.url()).pathname === `/api/bff/lots/${lotId}`,
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

  for (const visitor of VISITORS) {
    test(`desktop hover, ${visitor.name}: quick look opens and its lot read is served`, async ({
      context,
      page,
    }) => {
      await visitor.prepare(context);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const seen = recordBffLotReads(page);
      await page.goto(`${salePath}?view=grid`);

      const card = page.getByTestId("lot-card").first();
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();
      await card.hover();
      const trigger = card.getByRole("button", { name: /^Quick look at / });
      await expect(trigger).toBeVisible();

      const lotRead = page.waitForResponse((response) =>
        /^\/api\/bff\/lots\/[^/]+$/.test(new URL(response.url()).pathname),
      );
      const dialog = page.getByRole("dialog");
      // A press that lands before the sale page has hydrated focuses the button and opens nothing;
      // press again until the dialog (whose code is fetched on first open) shows.
      await expect(async () => {
        if (!(await dialog.isVisible())) await trigger.click({ timeout: 2_000 });
        await expect(dialog).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: LIVE_READ_TIMEOUT });
      await expect(dialog.getByRole("link", { name: "View lot" })).toBeVisible();

      const read = await lotRead;
      expect(read.status(), `GET ${new URL(read.url()).pathname}`).toBe(200);
      expectNoUnauthorised(seen);
    });
  }
});
