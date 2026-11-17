import { expect, test } from "@playwright/test";

test.describe("Artworks catalogue filters @a11y", () => {
  test("exposes sticky toolbar, sort, and desktop filter rail", async ({ page }, testInfo) => {
    await page.goto("/artworks");
    await expect(page.getByRole("heading", { name: "Editions", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Sort artworks")).toBeVisible();
    if (testInfo.project.name === "chromium-desktop") {
      await expect(page.getByRole("complementary", { name: "Filters" })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: /Filters/i })).toBeVisible();
    }
  });

  test("offers no originals or price-on-request filters", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop filter rail only");
    await page.goto("/artworks");
    const rail = page.getByRole("complementary", { name: "Filters" });
    await expect(rail.getByText("Artwork type")).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "Originals" })).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "Price on request" })).toHaveCount(0);
  });
});

test.describe("Artworks catalogue orientation and framing @a11y", () => {
  // Applied from the URL, so each group shows whatever the catalogue holds: an applied option
  // keeps its group, even with nothing else in it.
  const applied = "/artworks?orientation=portrait&framing=framed";

  test("shows applied orientation and framing in the rail and as chips", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "desktop filter rail only");
    await page.goto(applied);
    const rail = page.getByRole("complementary", { name: "Filters" });
    const orientation = rail.getByRole("group", { name: "Orientation" });
    const framing = rail.getByRole("group", { name: "Framing" });
    await expect(orientation.getByRole("checkbox", { name: /Portrait/ })).toBeChecked();
    await expect(framing.getByRole("checkbox", { name: /Available framed/ })).toBeChecked();

    // Artist, Price, Size, Orientation, Framing, Technique: the new groups sit together, in order.
    const titles = await rail
      .getByRole("group")
      .evaluateAll((groups) =>
        groups.map((group) => group.querySelector("legend")?.textContent ?? ""),
      );
    expect(titles.indexOf("Orientation")).toBeLessThan(titles.indexOf("Framing"));
    for (const before of ["Artist", "Price", "Size"]) {
      if (titles.includes(before)) {
        expect(titles.indexOf(before)).toBeLessThan(titles.indexOf("Orientation"));
      }
    }
    if (titles.includes("Technique")) {
      expect(titles.indexOf("Framing")).toBeLessThan(titles.indexOf("Technique"));
    }

    const portraitChip = page.getByRole("button", { name: "Portrait Remove filter" });
    await expect(portraitChip).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Available framed Remove filter" }),
    ).toBeVisible();
    await portraitChip.click();
    await expect(page).toHaveURL(/\/artworks\?framing=framed$/);
    await expect(page.getByRole("button", { name: "Portrait Remove filter" })).toHaveCount(0);
  });

  test("offers the groups in the phone filter sheet", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "phone filter sheet only");
    await page.goto(applied);
    await page.getByRole("button", { name: /Filter and sort/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filter and sort" });
    await expect(sheet.getByRole("group", { name: "Orientation" })).toBeVisible();
    await expect(
      sheet
        .getByRole("group", { name: "Framing" })
        .getByRole("checkbox", { name: /Available framed/ }),
    ).toBeChecked();
  });
});
