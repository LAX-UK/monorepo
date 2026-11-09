import type { Page, TestInfo } from "@playwright/test";

export {
  COLLECTION_JOURNEY_IDS,
  COLLECTION_JOURNEY_NAMES,
  COLLECTION_JOURNEY_REFERENCES,
  collectionJourneyVisits,
  workday,
} from "../../../../packages/db/src/seed/dev/collection-journey-ids";

/** "9 Nov 2026", the way the staff date field shows a typed day. */
export function staffDayText(day: string): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

/**
 * Takes a picture of the page as a step of a journey and attaches it to the report, so a reviewer
 * can see each state without running the stack.
 */
export async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}
