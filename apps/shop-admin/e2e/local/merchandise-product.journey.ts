import { expect, test } from "@playwright/test";

/**
 * Local-only journey for products: create one with its first variant, edit it, add and change a
 * variant, adjust stock with a reason, and archive it after confirming. Needs the stack and
 * scripts/local/start-shop-admin.sh, and the signed-in state that sign-in-local-staff.setup.ts
 * saves (run it first).
 */
test.use({ storageState: "e2e/.auth/shop_admin.json" });

test("creates a product, edits it and its variants, and archives it", async ({ page }) => {
  const stamp = Date.now();
  const slug = `journey-tote-${stamp}`;
  const sku = `JOURNEY-${stamp}`;

  await page.goto("/merchandise");
  await page.getByRole("link", { name: "New product" }).first().click();
  await expect(page).toHaveURL(/\/merchandise\/new$/);

  await page.getByLabel("Title", { exact: true }).fill("Journey tote bag");
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue("journey-tote-bag");
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByLabel("SKU", { exact: true }).fill(sku);
  await page.getByLabel("Price (£)").fill("15");
  await page.getByLabel("Opening stock").fill("4");
  await page.getByRole("button", { name: "Create product" }).click();

  await expect(page).toHaveURL(/\/merchandise\/[0-9a-f-]{36}$/);
  await expect(page.getByText("On sale", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(sku) })).toContainText("£15.00");

  await page.getByLabel("Description").fill("Heavy canvas, made for the journey.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible();

  await page.getByRole("button", { name: "Add variant" }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.getByLabel("SKU").fill(`${sku}-L`);
  await addDialog.getByLabel("Price (£)").fill("18.50");
  await addDialog.getByRole("button", { name: "Add variant" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`${sku}-L`) })).toContainText("£18.50");

  await page.getByRole("button", { name: `Adjust stock for ${sku}-L` }).click();
  const stockDialog = page.getByRole("dialog");
  await stockDialog.getByLabel("On hand").fill("7");
  await stockDialog.getByLabel("Reason").fill("Journey recount");
  await stockDialog.getByRole("button", { name: "Update stock" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`${sku}-L`) })).toContainText("7");

  await page.getByRole("button", { name: "Archive product" }).click();
  const confirm = page.getByRole("dialog", { name: "Archive “Journey tote bag”?" });
  await expect(confirm).toContainText("nothing is deleted");
  await confirm.getByRole("button", { name: "Archive product" }).click();
  await expect(page.getByRole("button", { name: "Restore product" })).toBeVisible();
});
