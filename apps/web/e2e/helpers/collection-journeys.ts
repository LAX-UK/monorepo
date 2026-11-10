import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import pg from "pg";

export {
  COLLECTION_JOURNEY_IDS,
  COLLECTION_JOURNEY_NAMES,
  COLLECTION_JOURNEY_REFERENCES,
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
 * Takes a picture of the page as a step of a journey, attaches it to the report, and keeps a copy
 * in `test-results/collection-journeys`, which a run uploads whether the journey passed or not (a
 * passed test's own output folder is cleared), so a reviewer can see each state without running
 * the stack.
 */
export async function shoot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const kept = path.join(process.cwd(), "test-results", "collection-journeys", `${name}.png`);
  await mkdir(path.dirname(kept), { recursive: true });
  await page.screenshot({ path: kept, fullPage: false });
  await testInfo.attach(name, { path: kept, contentType: "image/png" });
}

/**
 * The London day a seeded visit is on. The seed placed it by the day it ran, and a journey can run
 * on another day (across midnight), so the day is read from the visit, not worked out again.
 */
export async function seededVisitDay(reference: string): Promise<string> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to read a seeded visit");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ day: string }>(
      `select to_char(slot_start at time zone 'Europe/London', 'YYYY-MM-DD') as day
         from collection_booking
        where reference = $1`,
      [reference],
    );
    const day = result.rows[0]?.day;
    if (!day) throw new Error(`No seeded visit has the reference ${reference}`);
    return day;
  } finally {
    await client.end();
  }
}
