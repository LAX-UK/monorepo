import { type Page, expect, test } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./axe.js";
import { openStaffPage } from "./page-session.js";

/**
 * What the "Mirrored to Zoho" checks share (docs/design/staff-gaps-delivery-zoho-alerts.md, Z1–Z3):
 * the badge words, Z3's sentences, the fixtures `seed:zoho-mirror-badge` writes and the one check
 * every record's badge passes at a desk and on a phone. Literals rather than imports, so the specs
 * do not load the contracts package or shop-api.
 */
export const BADGE_LABEL = {
  mirrored: "Mirrored to Zoho",
  pending: "Sending to Zoho",
  failed: "Not in Zoho",
  dry_run: "Zoho dry run",
} as const;
export type BadgeState = keyof typeof BADGE_LABEL;
export type MirrorState = BadgeState | "not_applicable";
export const BADGE_STATES = Object.keys(BADGE_LABEL) as BadgeState[];

/** The seeded fixtures (apps/shop-api/src/infrastructure/seed/zoho-mirror-badge-seed.ts). */
export const FIXTURE_ORDERS = [
  "2a0e5d00-0000-4000-8000-000000000001",
  "2a0e5d00-0000-4000-8000-000000000002",
  "2a0e5d00-0000-4000-8000-000000000003",
  "2a0e5d00-0000-4000-8000-000000000004",
  "2a0e5d00-0000-4000-8000-000000000005",
];
export const FIXTURE_ARTWORKS = [
  "2a0e5d00-0000-4000-8000-0000000000a1",
  "2a0e5d00-0000-4000-8000-0000000000a2",
  "2a0e5d00-0000-4000-8000-0000000000a3",
  "2a0e5d00-0000-4000-8000-0000000000a4",
  "2a0e5d00-0000-4000-8000-0000000000a5",
];

/** A time as Z3 writes it: "16:10", or "14 Nov 2026, 16:02" (the LAX date style, no zone). */
const TIME = String.raw`(?:\d{1,2} [A-Z][a-z]{2} \d{4}, )?\d{2}:\d{2}`;

/** Z3's sentence that opens each state's details. */
const SENTENCE_START: Record<BadgeState, RegExp> = {
  mirrored: /^Last sent \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}\./,
  pending: new RegExp(
    String.raw`^Waiting to send the latest change\.( Tries again at ${TIME} \(attempt \d+\)\.)?$`,
  ),
  failed: /^Zoho refused the last change.*Staff in Failed jobs can fix and replay it\.$/,
  dry_run: /^LAX worked out what it would send and wrote nothing to Zoho\.$/,
};

export function badgeName(state: BadgeState): string {
  return `Zoho: ${BADGE_LABEL[state]}, details`;
}

/** Fail, in CI, where the fixtures are seeded; skip elsewhere, saying what is missing. */
export function requireFixture(id: string | undefined, what: string): string {
  if (id) return id;
  if (process.env.CI) {
    throw new Error(`Nothing is "${what}": the CI stack must run seed:zoho-mirror-badge first.`);
  }
  test.skip(true, `Nothing in this environment is "${what}"`);
  return "";
}

/** One record id per state, from one batched status read of the given ids. */
export async function recordsByState(
  page: Page,
  entity: "order" | "artwork",
  ids: readonly string[],
): Promise<Map<MirrorState, string>> {
  const found = new Map<MirrorState, string>();
  const unique = [...new Set(ids)].slice(0, 100);
  const statuses = await page.request.get(
    `/api/admin/zoho-mirror/statuses?entity=${entity}&ids=${unique.join(",")}`,
  );
  if (!statuses.ok()) return found;
  const body = (await statuses.json()) as { items: Array<{ id: string; state: MirrorState }> };
  for (const status of body.items) {
    if (!found.has(status.state)) found.set(status.state, status.id);
  }
  return found;
}

/**
 * The record's badge in its page header at a desk (a popover from the keyboard, focus in, Esc
 * back to the badge) and on a phone (a bottom sheet with a 44px close, no sideways scroll).
 */
export async function expectBadgeDetails(page: Page, path: string, state: BadgeState) {
  const label = BADGE_LABEL[state];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openStaffPage(page, path);
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
  const badge = header.getByRole("button", { name: badgeName(state), exact: true });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(label);
  await badge.focus();
  await page.keyboard.press("Enter");
  const details = page.getByRole("dialog", { name: label });
  await expect(details).toBeVisible();
  await expect(details.getByRole("heading", { name: label })).toBeVisible();
  await expect(details.locator("p").first()).toHaveText(SENTENCE_START[state]);
  // Focus moves to the details themselves for every state, whatever they hold (Z3).
  await expect(details).toBeFocused();
  // Each time in the sentence names its moment.
  for (const time of await details.locator("time").all()) {
    await expect(time).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
  }
  // Failed jobs only from a failure, and only where Bid says the person can open its Zoho rows.
  const failedJobs = details.getByRole("link", { name: /^Open in Failed jobs/ });
  if (state !== "failed") await expect(failedJobs).toHaveCount(0);
  else if ((await failedJobs.count()) > 0) {
    await expect(failedJobs).toHaveAttribute("href", /\/admin\/failed-jobs\?source=integrations$/);
  }
  await expectNoSeriousAxeViolations(page, `${path} (Zoho details)`);
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(badge).toBeFocused();

  // A phone: the same details in a bottom sheet with a 44px close.
  await page.setViewportSize({ width: 375, height: 812 });
  await openStaffPage(page, path);
  const phoneBadge = page.getByRole("button", { name: badgeName(state), exact: true });
  await phoneBadge.click();
  const sheet = page.getByRole("dialog", { name: label });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-side", "bottom");
  await expect(sheet).toBeFocused();
  const close = sheet.getByRole("button", { name: "Close" });
  const box = await close.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
  await close.click();
  await expect(sheet).toBeHidden();
  await expect(phoneBadge).toBeFocused();
}

/** A record with nothing to mirror has no Zoho badge at all. */
export async function expectNoBadge(page: Page, path: string) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openStaffPage(page, path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Zoho: / })).toHaveCount(0);
}
