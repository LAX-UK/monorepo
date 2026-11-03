import {
  shopArtist,
  shopArtwork,
  shopArtworkInterest,
  shopFollowedArtist,
  shopParty,
  shopSavedArtwork,
} from "@auction/db/schema";
import {
  type ExportSource,
  SourcedExportCategory,
} from "@auction/identity-contracts/subject-export-readers";
import { and, asc, eq } from "drizzle-orm";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired, workRef } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

type Origins = SubjectExportDeps["origins"];
type Channel = "shop" | "art";

type WorkColumns = { id: string; title: string; slug: string; salesChannel: Channel };

export function mapSavedWork(
  row: { id: string; createdAt: Date; work: WorkColumns },
  origins: Origins,
) {
  return {
    id: `saved:${row.id}`,
    origin: "provided" as const,
    kind: "saved_work",
    target: workRef(row.work, origins),
    savedAt: isoRequired(row.createdAt),
  };
}

export function mapFollowedArtist(
  row: { id: string; createdAt: Date; artistName: string; artistSlug: string },
  origins: Origins,
) {
  return {
    id: `followed:${row.id}`,
    origin: "provided" as const,
    kind: "followed_artist",
    target: {
      id: row.id,
      title: row.artistName,
      url: new URL(`/artists/${encodeURIComponent(row.artistSlug)}`, `${origins.art}/`).toString(),
    },
    savedAt: isoRequired(row.createdAt),
  };
}

/** An alert asked for on a sold-out edition. The unsubscribe token and contact address are not read. */
export function mapAvailabilityAlert(
  row: { id: string; createdAt: Date; work: WorkColumns },
  origins: Origins,
) {
  return {
    id: `alert:${row.id}`,
    origin: "provided" as const,
    kind: "availability_alert",
    target: workRef(row.work, origins),
    savedAt: isoRequired(row.createdAt),
  };
}

const workColumns = {
  workId: shopArtwork.id,
  workTitle: shopArtwork.title,
  workSlug: shopArtwork.slug,
  workChannel: shopArtwork.salesChannel,
};

const toWork = (row: {
  workId: string;
  workTitle: string;
  workSlug: string;
  workChannel: Channel;
}): WorkColumns => ({
  id: row.workId,
  title: row.workTitle,
  slug: row.workSlug,
  salesChannel: row.workChannel,
});

/**
 * Everything the person saved or follows, including works since withdrawn from sale: a saved
 * work is the person's own record, so it does not depend on the work still being public.
 */
export class SavedWorksCategory extends SourcedExportCategory {
  readonly id = "saved-works";
  protected readonly sources: readonly ExportSource[];

  constructor({ db, origins }: SubjectExportDeps) {
    super();
    const alerts = (s: string) =>
      and(
        eq(shopArtworkInterest.identitySubjectId, s),
        eq(shopArtworkInterest.intent, "notify_me"),
      );
    this.sources = [
      {
        count: (s) => countWhere(db, shopSavedArtwork, eq(shopSavedArtwork.identitySubjectId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopSavedArtwork.id,
              createdAt: shopSavedArtwork.createdAt,
              ...workColumns,
            })
            .from(shopSavedArtwork)
            .innerJoin(shopArtwork, eq(shopArtwork.id, shopSavedArtwork.artworkId))
            .where(
              and(eq(shopSavedArtwork.identitySubjectId, s), afterKey(shopSavedArtwork.id, after)),
            )
            .orderBy(asc(shopSavedArtwork.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapSavedWork({ ...row, work: toWork(row) }, origins),
          }));
        },
      },
      {
        count: (s) =>
          countWhere(db, shopFollowedArtist, eq(shopFollowedArtist.identitySubjectId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopFollowedArtist.id,
              createdAt: shopFollowedArtist.createdAt,
              artistName: shopParty.displayName,
              artistSlug: shopArtist.slug,
            })
            .from(shopFollowedArtist)
            .innerJoin(shopArtist, eq(shopArtist.id, shopFollowedArtist.artistId))
            .innerJoin(shopParty, eq(shopParty.id, shopArtist.partyId))
            .where(
              and(
                eq(shopFollowedArtist.identitySubjectId, s),
                afterKey(shopFollowedArtist.id, after),
              ),
            )
            .orderBy(asc(shopFollowedArtist.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapFollowedArtist(row, origins) }));
        },
      },
      {
        count: (s) => countWhere(db, shopArtworkInterest, alerts(s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: shopArtworkInterest.id,
              createdAt: shopArtworkInterest.createdAt,
              ...workColumns,
            })
            .from(shopArtworkInterest)
            .innerJoin(shopArtwork, eq(shopArtwork.id, shopArtworkInterest.artworkId))
            .where(and(alerts(s), afterKey(shopArtworkInterest.id, after)))
            .orderBy(asc(shopArtworkInterest.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapAvailabilityAlert({ ...row, work: toWork(row) }, origins),
          }));
        },
      },
    ];
  }
}
