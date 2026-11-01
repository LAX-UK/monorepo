import {
  RELEASE_LINEAGE_ADOPTIONS,
  type ReleaseLineageAdoption,
} from "./release-lineage-mapping.js";
import type { ArchivedReleaseRow, JournalMigration } from "./release-lineage-normalisation.js";

/**
 * Which pending main migrations the runner records without executing, because production
 * already ran the same SQL under its release tag. A migration qualifies only when it is on the
 * explicit allow-list and the release lineage archive holds that release row with the same hash.
 * Databases without an archive (test, developer, CI) adopt nothing.
 */
export function resolveReleaseLineageAdoptions(
  archive: readonly ArchivedReleaseRow[],
  allowList: readonly ReleaseLineageAdoption[] = RELEASE_LINEAGE_ADOPTIONS,
): ReadonlyMap<number, ReleaseLineageAdoption> {
  const archived = new Map(archive.map((row) => [row.createdAt, row.hash]));
  const adoptions = new Map<number, ReleaseLineageAdoption>();
  for (const entry of allowList) {
    if (archived.get(entry.releaseWhen) === entry.sha256) adoptions.set(entry.mainWhen, entry);
  }
  return adoptions;
}

/** The adoption for this migration, if any. Fails closed if main's SQL changed since approval. */
export function adoptionFor(
  migration: JournalMigration,
  adoptions: ReadonlyMap<number, ReleaseLineageAdoption>,
): ReleaseLineageAdoption | null {
  const adoption = adoptions.get(migration.folderMillis);
  if (!adoption) return null;
  if (adoption.sha256 !== migration.hash) {
    throw new Error(
      `${adoption.mainTag} no longer matches release ${adoption.releaseTag} (hash ${migration.hash}); it cannot be adopted. Manual reconciliation is required`,
    );
  }
  return adoption;
}
