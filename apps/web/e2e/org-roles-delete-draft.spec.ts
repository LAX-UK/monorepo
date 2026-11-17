import { randomUUID } from "node:crypto";
import { type Page, type TestInfo, expect, test } from "@playwright/test";
import pg from "pg";
import { e2eEnabled, e2eSkipReason } from "./helpers/auth";
import { roleAuthState } from "./helpers/auth-state";
import { shoot } from "./helpers/collection-journeys";
import { ORGANISATION_JOURNEY_NAMES, openAs } from "./helpers/organisation-journeys";

/**
 * "Delete draft" (GAP-53, docs/design/decision-pack-2026-11-17.md section 5): the consignor of
 * Northbank Gallery deletes a draft they started, from its row menu and from its page. Each asks
 * "Delete this draft?" first, says "Draft deleted", and the draft leaves the list. A colleague's
 * draft offers no Delete draft to a consignor; an owner may delete it.
 *
 * The journey adds its own drafts (titled with its tag) and removes every one afterwards, so the
 * seeded consignments stay as they are.
 */

const { approved } = ORGANISATION_JOURNEY_NAMES;
const TAG = `DD ${randomUUID().slice(0, 6)}`;
const SIZES = [
  { name: "1440", width: 1440, height: 1000 },
  { name: "375", width: 375, height: 812 },
] as const;
const SCHEMES = ["light", "dark"] as const;

type Seeded = { ids: string[]; title: (key: string) => string };
let seeded: Seeded | null = null;

function database(): pg.Client {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to add the journey's drafts");
  return new pg.Client({ connectionString });
}

/** A draft of Northbank's, started by `email`, titled with the journey's tag. */
async function addDrafts(drafts: { key: string; email: string }[]): Promise<Seeded> {
  const client = database();
  await client.connect();
  const title = (key: string) => `Draft study ${key} ${TAG}`;
  try {
    const ids: string[] = [];
    for (const draft of drafts) {
      const { rows } = await client.query<{ id: string }>(
        `insert into item_submission (legal_entity_id, title, status, submitted_by_user_id,
           medium, images)
         select le.id, $1, 'draft', u.id, 'Oil on canvas', '{}'
           from legal_entity le, "user" u
          where le.display_name = $2 and u.email = $3
         returning id`,
        [title(draft.key), approved, draft.email],
      );
      const id = rows[0]?.id;
      if (!id) throw new Error(`Could not add the draft for ${draft.email}`);
      ids.push(id);
    }
    return { ids, title };
  } finally {
    await client.end();
  }
}

async function deletedAt(id: string): Promise<Date | null> {
  const client = database();
  await client.connect();
  try {
    const { rows } = await client.query<{ deleted_at: Date | null }>(
      "select deleted_at from item_submission where id = $1",
      [id],
    );
    return rows[0]?.deleted_at ?? null;
  } finally {
    await client.end();
  }
}

async function shootSchemes(page: Page, testInfo: TestInfo, name: string, size: string) {
  // As the workspace baselines do: no cross-fade between schemes in the captures.
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== "running"),
    );
    await shoot(page, testInfo, `delete-draft-${name}-${size}-${scheme}`);
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}

async function acceptCookies(page: Page) {
  const cookies = page.getByRole("button", { name: "Accept all" });
  if (await cookies.isVisible().catch(() => false)) await cookies.click();
}

test.describe("delete draft @roles", () => {
  test.skip(!e2eEnabled, e2eSkipReason);
  test.describe.configure({ retries: 0, mode: "serial" });

  test.beforeAll(async () => {
    const consignor = process.env.PLAYWRIGHT_ORG_CONSIGNOR_EMAIL ?? "consignor@lax.bid";
    const owner = process.env.PLAYWRIGHT_ORG_EMAIL ?? "estate-owner@lax.bid";
    seeded = await addDrafts([
      ...SIZES.flatMap((size) => [
        { key: `row ${size.name}`, email: consignor },
        { key: `page ${size.name}`, email: consignor },
      ]),
      { key: "colleague", email: owner },
      { key: "for owner", email: consignor },
    ]);
  });
  test.afterAll(async () => {
    if (!seeded) return;
    const client = database();
    await client.connect();
    try {
      await client.query("delete from item_submission where id = any($1::uuid[])", [seeded.ids]);
    } finally {
      await client.end();
    }
  });

  for (const [index, size] of SIZES.entries()) {
    test(`a consignor deletes their own draft from its row and its page, at ${size.name}`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      test.setTimeout(150_000);
      if (!seeded) throw new Error("The journey's drafts were not added");
      const rowDraft = seeded.ids[index * 2] as string;
      const pageDraft = seeded.ids[index * 2 + 1] as string;
      const rowTitle = seeded.title(`row ${size.name}`);
      const session = await openAs(browser, roleAuthState.orgConsignor, approved, baseURL);
      const { page } = session;
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      const all = (shots: string) => shootSchemes(page, testInfo, shots, size.name);

      await test.step("the row menu offers Delete draft, last and apart", async () => {
        await page.goto(`/selling/consignments?tab=all&q=${encodeURIComponent(TAG)}`);
        await acceptCookies(page);
        await page.getByRole("button", { name: `More for ${rowTitle}` }).click();
        const item = page.getByRole("menuitem", { name: "Delete draft" });
        await expect(item).toBeVisible();
        await all("1-row-menu");
        // A colleague's draft is not the consignor's to delete, nor even to see.
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("button", { name: `More for ${seeded?.title("colleague")}` }),
        ).toHaveCount(0);
      });

      await test.step("it asks first, then deletes, and says so", async () => {
        await page.getByRole("button", { name: `More for ${rowTitle}` }).click();
        await page.getByRole("menuitem", { name: "Delete draft" }).click();
        const dialog = page.getByRole("dialog", { name: "Delete this draft?" });
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByText("Its photos and answers are removed. This cannot be undone."),
        ).toBeVisible();
        await all("2-confirm");
        expect(await deletedAt(rowDraft)).toBeNull();
        await dialog.getByRole("button", { name: "Delete draft" }).click();
        await expect(page.getByText("Draft deleted")).toBeVisible();
        expect(await deletedAt(rowDraft)).not.toBeNull();
        await expect(page.getByRole("button", { name: `More for ${rowTitle}` })).toHaveCount(0);
        await all("3-deleted");
      });

      await test.step("the draft's page offers Delete draft too, and returns to the list", async () => {
        await page.goto(`/selling/consignments/${pageDraft}`);
        const button = page.getByRole("button", { name: "Delete draft" });
        await expect(button).toBeVisible();
        await button.scrollIntoViewIfNeeded();
        await all("4-draft-page");
        await button.click();
        const dialog = page.getByRole("dialog", { name: "Delete this draft?" });
        await all("5-draft-page-confirm");
        await dialog.getByRole("button", { name: "Delete draft" }).click();
        await expect(page).toHaveURL(/\/selling\/consignments(\?.*)?$/);
        await expect(page.getByText("Draft deleted")).toBeVisible();
        expect(await deletedAt(pageDraft)).not.toBeNull();
        // Gone: its old address no longer opens it.
        await page.goto(`/selling/consignments/${pageDraft}`);
        await expect(page.getByRole("button", { name: "Delete draft" })).toHaveCount(0);
      });

      await session.close();
    });
  }

  test("an owner is offered Delete draft on a consignor's draft", async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    if (!seeded) throw new Error("The journey's drafts were not added");
    const owner = await openAs(browser, roleAuthState.buyer, approved, baseURL);
    const { page } = owner;
    await page.goto(`/selling/consignments/${seeded.ids.at(-1)}`);
    await acceptCookies(page);
    await expect(page.getByRole("button", { name: "Delete draft" })).toBeVisible();
    await owner.close();
  });
});
