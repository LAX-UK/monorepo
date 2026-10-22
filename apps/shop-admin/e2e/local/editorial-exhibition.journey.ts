import { expect, test } from "@playwright/test";

/**
 * Local-only journey for the exhibition editor: create a draft, save an edit, publish with the
 * confirmation. Needs the stack and scripts/local/start-shop-admin.sh, and the signed-in state
 * that sign-in-local-staff.setup.ts saves (run it first).
 */
test.use({ storageState: "e2e/.auth/catalogue_editor.json" });

test("creates a draft exhibition, saves a change and publishes it after confirming", async ({
  page,
}) => {
  const slug = `journey-${Date.now()}`;

  await page.goto("/editorial/exhibitions");
  await page.getByRole("link", { name: "New exhibition" }).first().click();
  await expect(page).toHaveURL(/\/editorial\/exhibitions\/new$/);

  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("Title", { exact: true }).fill("Journey exhibition");
  await page.getByRole("button", { name: "Create draft" }).click();

  await expect(page).toHaveURL(/\/editorial\/exhibitions\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible();

  await page.getByLabel("Subtitle (optional)").fill("Added after creation");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish “Journey exhibition”" });
  await expect(dialog).toContainText("goes live on lax.art");
  await dialog.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
});
