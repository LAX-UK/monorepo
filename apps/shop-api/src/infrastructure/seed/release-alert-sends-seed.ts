/**
 * Fixture releases for LAX Admin's release-alert send log (docs/design/staff-gaps-delivery-zoho-
 * alerts.md, LA-3), so the browser gate opens every status against a real stack rather than
 * skipping the ones the environment happens not to hold: one published edition per status, each
 * with the announcement, matches and digests the alert engine would have left.
 *
 * - Sent: expanded; 3 emailed and 1 dropped (`topic_off`), counted on the announcement.
 * - Sending: expanded; 1 emailed, 2 matches still waiting for a digest. Its title is long.
 * - Not sent yet: expanded; 1 match in a digest made 30 hours ago and never sent.
 * - Not announced: the publisher unticked "Tell subscribers".
 * - Queued: announced, not yet expanded into matches. Its work went back to draft before the
 *   alert run, so the stack's own alert run leaves it queued rather than expanding it.
 * - Counts not kept: from before migration 0405 (no counters); 2 matches left, both emailed.
 *
 * The Sending release has a long title, so the log is seen with one at 1440 and 375 px.
 *
 * The rows are made up, not written by the alert engine, so this runs only on a hermetic local
 * database (marked "local" and at a local address), such as the CI browser-gate stack.
 *
 * That stack does run shop-api's scheduler (`SHOP_SCHEDULER_ENABLED` defaults to on, every 60s),
 * with the alert matching and digest tasks. The fixtures hold still under it only because:
 * - the digest task does nothing while `ALERTS_SEND_MODE` is `off`. That is the default, and the
 *   browser-gate job pins it (`.github/workflows/e2e-pr.yml`); the send log e2e refuses to run
 *   in CI under any other mode. With `dry_run` or `on`, the task would build and mark digests for
 *   Sending's waiting matches and Not sent yet's stuck one, and both would read as Sent;
 * - the matching task expands only releases of works on sale, so Queued's work is a draft.
 *
 * Insert-once: works have fixed import keys and a release is written only when its announcement is
 * missing, so a second run changes nothing. Made-up titles and `example.com` addresses only.
 */
import { type Database, type SeedTargetEnv, assertSeedTarget } from "@auction/db";
import { sql } from "drizzle-orm";
import { artworkItemKey } from "../../application/alerts/alert-items.js";
import { createDrizzleArtworkImportRepository } from "../drizzle-artwork-import.repository.js";

export const RELEASE_ALERT_SENDS_SEED = "seed:release-alert-sends";

/** The subject and name the fixtures are published by (a made-up person). */
export const RELEASE_ALERT_FIXTURE_PUBLISHER = {
  subjectId: `${RELEASE_ALERT_SENDS_SEED}:publisher`,
  name: "Ada Example",
} as const;

type Settled = "emailed" | "waiting" | "stuck" | { dropped: string };

export type ReleaseAlertFixture = {
  /** The work's title; the send log e2e finds each release by it. */
  title: string;
  /** Hours before the seed ran that it was published, so the log lists them in this order. */
  publishedHoursAgo: number;
  announce: boolean;
  expanded: boolean;
  /** False for a work back in draft: the alert run only expands releases of works on sale. */
  onSale: boolean;
  /** False for a release from before the counts were kept on the announcement. */
  countsKept: boolean;
  /** Who it was published by; null for a release whose publisher was never kept. */
  publishedBy: string | null;
  /** How each person's match ended up. */
  matches: readonly Settled[];
};

/** The Sending fixture's title: long enough to be cut short at 1440 px and on a phone. */
export const RELEASE_ALERT_LONG_FIXTURE_TITLE =
  "Night ferry, crossing at low tide after Whistler: second state, signed proof with the artist's annotations";

/** One release per status the log shows, by the status the read derives for it. */
export const RELEASE_ALERT_FIXTURES = {
  sent: {
    title: "Tidal study",
    publishedHoursAgo: 1,
    announce: true,
    expanded: true,
    onSale: true,
    countsKept: true,
    publishedBy: RELEASE_ALERT_FIXTURE_PUBLISHER.subjectId,
    matches: ["emailed", "emailed", "emailed", { dropped: "topic_off" }],
  },
  sending: {
    // Long on purpose: the log's truncation, the phone row and the panel header are seen with it.
    title: RELEASE_ALERT_LONG_FIXTURE_TITLE,
    publishedHoursAgo: 2,
    announce: true,
    expanded: true,
    onSale: true,
    countsKept: true,
    publishedBy: RELEASE_ALERT_FIXTURE_PUBLISHER.subjectId,
    matches: ["emailed", "waiting", "waiting"],
  },
  not_sent_yet: {
    title: "Salt marsh",
    publishedHoursAgo: 31,
    announce: true,
    expanded: true,
    onSale: true,
    countsKept: true,
    publishedBy: RELEASE_ALERT_FIXTURE_PUBLISHER.subjectId,
    matches: ["stuck"],
  },
  not_announced: {
    title: "Quiet harbour",
    publishedHoursAgo: 32,
    announce: false,
    expanded: true,
    onSale: true,
    countsKept: true,
    publishedBy: RELEASE_ALERT_FIXTURE_PUBLISHER.subjectId,
    matches: [],
  },
  queued: {
    title: "First light",
    publishedHoursAgo: 33,
    announce: true,
    expanded: false,
    onSale: false,
    countsKept: true,
    publishedBy: null,
    matches: [],
  },
  counts_not_kept: {
    title: "Old pier",
    publishedHoursAgo: 34,
    announce: true,
    expanded: true,
    onSale: true,
    countsKept: false,
    publishedBy: null,
    matches: ["emailed", "emailed"],
  },
} as const satisfies Record<string, ReleaseAlertFixture>;

export type ReleaseAlertFixtureStatus = keyof typeof RELEASE_ALERT_FIXTURES;

export type ReleaseAlertSendsSeedResult = {
  /** The statuses whose release this run wrote; empty on a second run. */
  created: ReleaseAlertFixtureStatus[];
};

/** Writes the fixtures once the target is known to be hermetic; replaced by a spy in the guard test. */
export type ReleaseAlertFixtureWriter = (
  db: Database,
  now: Date,
) => Promise<ReleaseAlertSendsSeedResult>;

const HOUR = 60 * 60 * 1000;

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];
}

export async function seedReleaseAlertSendFixtures(
  db: Database,
  env: SeedTargetEnv,
  now: Date = new Date(),
  write: ReleaseAlertFixtureWriter = writeReleaseAlertFixtures,
): Promise<ReleaseAlertSendsSeedResult> {
  const target = await assertSeedTarget(db, RELEASE_ALERT_SENDS_SEED, env);
  if (!target.hermetic) {
    throw new Error(
      `[${RELEASE_ALERT_SENDS_SEED}] refusing to seed: the database is marked "${target.environment}", not a hermetic local one`,
    );
  }
  return write(db, now);
}

async function writeReleaseAlertFixtures(
  db: Database,
  now: Date,
): Promise<ReleaseAlertSendsSeedResult> {
  const works = createDrizzleArtworkImportRepository(db, "off");
  await db.execute(sql`
    INSERT INTO shop_user_profile (identity_subject_id, name)
    VALUES (${RELEASE_ALERT_FIXTURE_PUBLISHER.subjectId}, ${RELEASE_ALERT_FIXTURE_PUBLISHER.name})
    ON CONFLICT (identity_subject_id) DO NOTHING
  `);
  const created: ReleaseAlertFixtureStatus[] = [];
  for (const [status, fixture] of Object.entries(RELEASE_ALERT_FIXTURES) as [
    ReleaseAlertFixtureStatus,
    ReleaseAlertFixture,
  ][]) {
    const key = `${RELEASE_ALERT_SENDS_SEED}:${status}`;
    const { artworkId } = await works.importArtwork({
      importKey: key,
      publishOnCreate: fixture.onSale,
      slug: `release-alert-fixture-${status.replaceAll("_", "-")}`,
      title: fixture.title,
      description: null,
      primaryImageUrl: null,
      artistSlug: "release-alert-fixture-artist",
      artistDisplayName: "Fixture Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });
    if (await writeRelease(db, artworkItemKey(artworkId), key, fixture, now)) created.push(status);
  }
  return { created };
}

/** One release and its matches, in one transaction; false when it was already there. */
async function writeRelease(
  db: Database,
  itemKey: string,
  key: string,
  fixture: ReleaseAlertFixture,
  now: Date,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const at = new Date(now.getTime() - fixture.publishedHoursAgo * HOUR);
    const emailed = fixture.matches.filter((m) => m === "emailed").length;
    const dropped: Record<string, number> = {};
    for (const m of fixture.matches) {
      if (typeof m === "object") dropped[m.dropped] = (dropped[m.dropped] ?? 0) + 1;
    }
    const droppedCount = Object.values(dropped).reduce((sum, n) => sum + n, 0);
    const kept = fixture.countsKept;
    const inserted = await tx.execute(sql`
      INSERT INTO shop_alert_announcement (item_key, announced_at, announce, expanded_at, kind,
        announced_by, matched_count, emailed_count, dropped_count, dropped_reasons)
      VALUES (${itemKey}, ${at}, ${fixture.announce}, ${fixture.expanded ? at : null}, 'shop_release',
        ${fixture.publishedBy},
        ${kept && fixture.expanded ? fixture.matches.length : null},
        ${kept ? emailed : null}, ${kept ? droppedCount : null},
        ${kept ? JSON.stringify(dropped) : null}::jsonb)
      ON CONFLICT (item_key) DO NOTHING
      RETURNING item_key
    `);
    if (rowsOf(inserted).length === 0) return false;
    for (const [index, settled] of fixture.matches.entries()) {
      const person = await tx.execute(sql`
        INSERT INTO shop_alert_subscriber (product, email, status, consent_text, consent_source,
          requested_at, confirmed_at)
        VALUES ('shop', ${`${key.replaceAll(":", "-")}-${index + 1}@example.com`}, 'confirmed',
          'Fixture consent.', 'shop_home', ${at}, ${at})
        RETURNING id
      `);
      const subscriberId = rowsOf<{ id: string }>(person)[0]?.id;
      if (!subscriberId) throw new Error(`[${RELEASE_ALERT_SENDS_SEED}] subscriber not written`);
      let digestId: string | null = null;
      if (settled === "emailed" || settled === "stuck") {
        // A stuck digest was made 30 hours ago and never sent: past the 24-hour threshold.
        const madeAt = settled === "stuck" ? new Date(now.getTime() - 30 * HOUR) : at;
        const digest = await tx.execute(sql`
          INSERT INTO shop_alert_digest (subscriber_id, product, local_date, item_count,
            outbox_idempotency_key, created_at, sent_at)
          VALUES (${subscriberId}, 'shop', ${madeAt.toISOString().slice(0, 10)}, 1,
            ${`${key}:${index + 1}`}, ${madeAt}, ${settled === "emailed" ? madeAt : null})
          RETURNING id
        `);
        digestId = rowsOf<{ id: string }>(digest)[0]?.id ?? null;
      }
      await tx.execute(sql`
        INSERT INTO shop_alert_match (subscriber_id, topic, item_key, snapshot, matched_at,
          digest_id, dropped_reason)
        VALUES (${subscriberId}, 'shop.releases', ${itemKey},
          ${JSON.stringify({ title: fixture.title, path: "/artworks/fixture" })}::jsonb, ${at},
          ${digestId}, ${typeof settled === "object" ? settled.dropped : null})
      `);
    }
    return true;
  });
}
