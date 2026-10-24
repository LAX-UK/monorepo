import { type Page, expect, test } from "@playwright/test";

/**
 * Local-only journey for the linked-artworks list of an exhibition: add two artworks by
 * searching, reorder them, save with the editor's one Save, reload and see the order kept. Needs the
 * stack, scripts/local/start-shop-admin.sh and the signed-in state that
 * sign-in-local-staff.setup.ts saves (run it first).
 *
 * Optional environment: LINKS_SHOTS_DIR, a directory to save desktop and phone screenshots into.
 */
test.use({ storageState: "e2e/.auth/catalogue_editor.json" });

const artworksSection = (page: Page) =>
  page.getByRole("region", { name: "Artworks in this exhibition" });

async function addByTitle(page: Page, query: string, title: string) {
  const section = artworksSection(page);
  await section.getByRole("combobox", { name: "Add artwork" }).click();
  await page.getByPlaceholder("Search artworks by name").fill(query);
  await page.getByRole("option", { name: new RegExp(title) }).click();
}

async function titlesInOrder(page: Page): Promise<string[]> {
  const rows = artworksSection(page).getByRole("list", { name: "Artworks in this exhibition" });
  return rows.getByRole("listitem").locator("span.truncate:not(.text-staff-xs)").allInnerTexts();
}

async function shoot(page: Page, name: string) {
  const dir = process.env.LINKS_SHOTS_DIR;
  if (!dir) return;
  for (const [label, width, height] of [
    ["1440", 1440, 1000],
    ["375", 375, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await artworksSection(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/${name}-${label}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

test("links two artworks to an exhibition, reorders them with the keyboard and keeps the order", async ({
  page,
}) => {
  const slug = `links-journey-${Date.now()}`;

  await page.goto("/editorial/exhibitions/new");
  await expect(page.getByText(/can be linked once the draft has been created/)).toBeVisible();
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("Title", { exact: true }).fill("Links journey");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/editorial\/exhibitions\/[0-9a-f-]{36}$/);
  const editorUrl = page.url();

  await page.getByRole("button", { name: "Publish" }).click();
  await page
    .getByRole("dialog", { name: "Publish “Links journey”" })
    .getByRole("button", { name: "Publish" })
    .click();
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

  await expect(artworksSection(page).getByText("No artworks linked yet.")).toBeVisible();
  await addByTitle(page, "Tidal", "Tidal Forms");
  await addByTitle(page, "Orchard", "Quiet Orchard");
  expect(await titlesInOrder(page)).toEqual(["Tidal Forms", "Quiet Orchard"]);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await shoot(page, "unsaved");

  await artworksSection(page).getByRole("button", { name: "Move Quiet Orchard up" }).click();
  expect(await titlesInOrder(page)).toEqual(["Quiet Orchard", "Tidal Forms"]);

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Exhibition saved.")).toBeVisible();
  await expect(page.getByText("Unsaved changes")).toBeHidden();

  await page.goto(editorUrl);
  expect(await titlesInOrder(page)).toEqual(["Quiet Orchard", "Tidal Forms"]);
  await shoot(page, "saved");
});
