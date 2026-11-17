import { randomUUID } from "node:crypto";
import { type Page, type TestInfo, expect, test } from "@playwright/test";
import pg from "pg";
import { e2eEnabled, hasStaffCredentials } from "./helpers/auth";
import { shoot } from "./helpers/collection-journeys";

/**
 * Bid admin › Deliveries › "Can't deliver" (docs/design/staff-gaps-delivery-zoho-alerts.md, D5,
 * D6, D8; D9 step 3). Staff open a buyer's request in the queue panel, press Can't deliver, are
 * told under the one field that a reason is needed, and send one. When the buyer withdrew and
 * asked again while the dialog was open, the dialog shows the stale Notice and nothing is
 * declined; on the request as it is now, the decline closes it as "Declined by LAX" with the
 * reason, and focus is back on the panel's title.
 *
 * The journey makes its own made-up sale, won lot and request, and removes them afterwards, so it
 * never depends on demo data. Tagged `@smoke` so the PR browser gate runs it on every pull
 * request. It never skips: without the e2e stack, staff credentials or `DATABASE_URL` it fails.
 */

const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;
const TAG = `E2E ${randomUUID().slice(0, 6)}`;
const REASON = "We can't insure a framed work of this size to this address.";

/**
 * Shoots a state at 1440 and 375, light and dark. Going from the side panel to the phone one
 * draws the panel again, which closes a dialog open in it, so `prepare` sets the state up again
 * at each width (the colour scheme changes nothing).
 */
async function shootAll(
  page: Page,
  testInfo: TestInfo,
  name: string,
  prepare: () => Promise<void> = async () => {},
) {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await prepare();
    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      // Colours ease to the new scheme; shoot once they have arrived, not halfway.
      await page.evaluate(() =>
        Promise.all(
          document.getAnimations().map((animation) => animation.finished.catch(() => {})),
        ),
      );
      await shoot(page, testInfo, `deliveries-decline-${name}-${size.name}-${scheme}`);
    }
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

type Seeded = { userId: string; entityIds: string[]; saleId: string; lotId: string };

function requireStack() {
  if (!e2eEnabled) {
    throw new Error("Set PLAYWRIGHT_E2E=1 and start the e2e stack to run Can't deliver");
  }
  if (!hasStaffCredentials()) {
    throw new Error("PLAYWRIGHT_STAFF_EMAIL and PLAYWRIGHT_STAFF_PASSWORD are required");
  }
}

function database(): pg.Client {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to add the journey's request");
  return new pg.Client({ connectionString });
}

async function withClient<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = database();
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** A made-up buyer and seller, a closed sale, and one won lot with a request for a price. */
async function seedRequest(): Promise<Seeded> {
  const userId = `e2e-decline-${randomUUID().slice(0, 8)}`;
  const [seller, buyer] = [randomUUID(), randomUUID()];
  const saleId = randomUUID();
  const lotId = randomUUID();
  await withClient(async (client) => {
    try {
      await client.query("begin");
      await client.query(
        `insert into "user" (id, name, email, email_verified, created_at, updated_at)
         values ($1, $1, $2, true, now(), now())`,
        [userId, `${userId}@example.test`],
      );
      await client.query(
        "insert into bid_user_profile (user_id, created_at, updated_at) values ($1, now(), now())",
        [userId],
      );
      for (const [id, name] of [
        [seller, `Example Seller ${TAG}`],
        [buyer, `Example Buyer ${TAG}`],
      ] as const) {
        await client.query(
          `insert into legal_entity (id, display_name, kind, subkind, created_by_user_id, status)
           values ($1, $2, 'organisation', 'gallery', $3, 'approved')`,
          [id, name, userId],
        );
      }
      await client.query(
        `insert into sale (id, title, start_time, end_time, created_by_legal_entity_id)
         values ($1, $2, now() - interval '2 days', now() - interval '1 day', $3)`,
        [saleId, `Example sale ${TAG}`, seller],
      );
      await client.query(
        `insert into lot (id, seller_legal_entity_id, sale_id, lot_number, title, auction_type,
           starting_price, current_price, start_time, end_time, status, winner_id,
           buyer_legal_entity_id)
         values ($1, $2, $3, 963, 'Estuary at noon', 'english', 100, 1250,
           now() - interval '2 days', now() - interval '1 day', 'ended', $4, $5)`,
        [lotId, seller, saleId, userId, buyer],
      );
      await client.query(
        `insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, requested_at)
         values ($1, $2, 'requested', $3, now() - interval '3 hours')`,
        [lotId, buyer, `1 Example Quay, ${TAG}, France`],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
  return { userId, entityIds: [buyer, seller], saleId, lotId };
}

/** The buyer withdraws and asks again for another address, as if from their purchase page. */
async function buyerAsksAgain(seeded: Seeded) {
  await withClient(async (client) => {
    await client.query("begin");
    await client.query(
      `update delivery_quote set status = 'withdrawn', decided_at = now(), updated_at = now()
        where lot_id = $1 and status = 'requested'`,
      [seeded.lotId],
    );
    await client.query(
      `insert into delivery_quote (lot_id, buyer_legal_entity_id, status, destination, requested_at)
       values ($1, $2, 'requested', $3, now())`,
      [seeded.lotId, seeded.entityIds[0], `2 Example Row, ${TAG}, London`],
    );
    await client.query("commit");
  });
}

async function removeRequest(seeded: Seeded | null) {
  if (!seeded) return;
  await withClient(async (client) => {
    const quotes = await client.query<{ id: string }>(
      "select id from delivery_quote where lot_id = $1",
      [seeded.lotId],
    );
    const quoteIds = quotes.rows.map((row) => row.id);
    await client.query("delete from domain_events where aggregate_id = any($1::text[])", [
      quoteIds,
    ]);
    await client.query("delete from delivery_quote where lot_id = $1", [seeded.lotId]);
    await client.query("delete from lot where id = $1", [seeded.lotId]);
    await client.query("delete from sale where id = $1", [seeded.saleId]);
    await client.query("delete from legal_entity where id = any($1::uuid[])", [seeded.entityIds]);
    await client.query("delete from bid_user_profile where user_id = $1", [seeded.userId]);
    await client.query('delete from "user" where id = $1', [seeded.userId]);
  });
}

test.describe("deliveries: can't deliver @smoke @journey", () => {
  test.describe.configure({ retries: 0 });

  let seeded: Seeded | null = null;
  test.beforeAll(async () => {
    requireStack();
    seeded = await seedRequest();
  });
  test.afterAll(async () => {
    await removeRequest(seeded);
  });

  test("declines a buyer's request with a reason, and refuses a request that changed", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    if (!seeded) throw new Error("The journey's request was not added");
    const lotId = seeded.lotId;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin/deliveries?q=${encodeURIComponent(TAG)}&record=${lotId}`);
    const panel = page.getByRole("dialog", { name: /^Lot 963 · Estuary at noon$/ });
    const action = panel.getByRole("button", { name: "Can't deliver" });
    const decline = page.getByRole("dialog", { name: "Can't deliver Lot 963 · Estuary at noon?" });
    const reason = decline.getByLabel("Reason for the buyer");
    const submit = decline.getByRole("button", { name: "Decline and email the buyer" });

    await test.step("the footer offers Can't deliver; a missing reason is said under the one field", async () => {
      await expect(panel.getByText("Waiting for a price").first()).toBeVisible();
      await action.click();
      await expect(decline).toBeVisible();
      await expect(reason).toBeFocused();
      await submit.click();
      await expect(decline.getByText("Tell the buyer why you can't deliver")).toBeVisible();
      await expect(reason).toHaveAttribute("aria-invalid", "true");
      await expect(reason).toBeFocused();
      // Keyboard first: the shots below switch the panel between its side and phone forms.
      await page.keyboard.press("Escape");
      await expect(decline).toHaveCount(0);
      await expect(action).toBeFocused();
    });

    const openDecline = async () => {
      if (!(await decline.isVisible())) await action.click();
      await expect(reason).toBeFocused();
    };
    // Back at 1440 after the shots the panel was drawn again, which already closed the dialog.
    const closeDecline = async () => {
      if (await decline.isVisible()) await decline.getByRole("button", { name: "Cancel" }).click();
      await expect(decline).toHaveCount(0);
    };

    await test.step("screenshots: the dialog, and the missing reason", async () => {
      await shootAll(page, testInfo, "1-dialog", openDecline);
      await shootAll(page, testInfo, "2-reason-missing", async () => {
        await openDecline();
        await submit.click();
        await expect(decline.getByText("Tell the buyer why you can't deliver")).toBeVisible();
      });
      await closeDecline();
    });

    await test.step("the buyer asked again meanwhile: the stale Notice, and nothing is declined", async () => {
      // Once at each width, so each shot shows a real refusal from the API.
      await shootAll(page, testInfo, "3-stale", async () => {
        if (!seeded) throw new Error("The journey's request was not added");
        await openDecline();
        await reason.fill(REASON);
        await buyerAsksAgain(seeded);
        await submit.click();
        await expect(decline.getByRole("alert")).toContainText(
          "This request changed while you had it open.",
        );
        // The panel reloads behind the dialog to the new request.
        await expect(panel.getByText(`2 Example Row, ${TAG}, London`).first()).toBeAttached();
      });
      await closeDecline();
      await expect(panel.getByText("Waiting for a price").first()).toBeVisible();
    });

    await test.step("declining the request as it is now closes it as Declined by LAX", async () => {
      await action.click();
      await reason.fill(`  ${REASON}  `);
      await submit.click();
      await expect(decline).toHaveCount(0);
      await expect(page.getByText(/Declined the delivery request for Lot 963/)).toBeVisible();
      await expect(panel.getByText("Declined by LAX").first()).toBeVisible();
      await expect(panel.getByText(REASON, { exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "Can't deliver" })).toHaveCount(0);
      await expect(panel.getByRole("heading", { level: 2 })).toBeFocused();
      await expect(
        panel.getByText("The buyer changed this request while you were looking at it."),
      ).toHaveCount(0);
      // The toast (5 s) sits over the Activity on a phone; shoot once it has gone.
      await expect(page.getByText(/Declined the delivery request for Lot 963/)).toHaveCount(0, {
        timeout: 15_000,
      });
      await shootAll(page, testInfo, "4-declined");
    });

    await test.step("the decline is stored once, with an audit row and no reason in it", async () => {
      await withClient(async (client) => {
        const quotes = await client.query<{ status: string; decline_reason: string | null }>(
          `select status, decline_reason from delivery_quote where lot_id = $1
            order by requested_at`,
          [lotId],
        );
        // Two requests the buyer withdrew while the dialog was open (one per width shot), and
        // the one declined as it is now.
        expect(quotes.rows).toEqual([
          { status: "withdrawn", decline_reason: null },
          { status: "withdrawn", decline_reason: null },
          { status: "withdrawn", decline_reason: REASON },
        ]);
        const events = await client.query<{ payload: unknown }>(
          `select payload from domain_events where event_type = 'delivery_quote.declined'
            and payload->>'lotId' = $1`,
          [lotId],
        );
        expect(events.rows).toHaveLength(1);
        expect(JSON.stringify(events.rows[0]?.payload)).not.toContain("insure");
      });
    });
  });
});
