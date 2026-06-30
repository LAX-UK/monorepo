import type { Database } from "@auction/db";
import { artistCategories, artistProfile } from "@auction/db/schema";
import { parseCreatorAttributes } from "@auction/validators";
import { eq } from "drizzle-orm";
import type { ArtistRecord, CreateArtistInput } from "../interfaces/artist-registry.js";
import { rowToRecord, slugify } from "./artist-registry-helpers.js";

/** Resolves a unique `artist_profile.slug` by appending `-N` on collision.
 * Exported so other services (e.g. submission approval) can inline-create an
 * artist row inside their own transaction without re-implementing the
 * collision logic.
 *
 * `ignoreArtistId` — when provided, treat that artist's existing slug as
 * "free" so admin update flows keep their slug when no other artist holds it. */
export async function resolveUniqueArtistSlug(
  tx: Database,
  displayName: string,
  ignoreArtistId?: string,
): Promise<string> {
  const baseSlug = slugify(displayName);
  if (baseSlug.length === 0) throw new Error("artist_slug_invalid");
  let slug = baseSlug;
  let attempt = 1;
  while (slug.length > 0) {
    const existing = await tx
      .select({ id: artistProfile.id })
      .from(artistProfile)
      .where(eq(artistProfile.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
    if (ignoreArtistId && existing[0]?.id === ignoreArtistId) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  throw new Error("artist_slug_resolution_failed");
}

/** Replace the category (department) links for an artist inside a transaction.
 * Centralised so the inline-create path, admin create, and admin update share
 * one policy (delete-then-insert, idempotent). */
export async function replaceArtistCategoriesInTx(
  tx: Database,
  artistProfileId: string,
  categoryIds: readonly string[],
): Promise<void> {
  await tx.delete(artistCategories).where(eq(artistCategories.artistProfileId, artistProfileId));
  const unique = [...new Set(categoryIds)];
  if (unique.length === 0) return;
  await tx
    .insert(artistCategories)
    .values(unique.map((categoryId, index) => ({ artistProfileId, categoryId, sortOrder: index })))
    .onConflictDoNothing();
}

/** Insert a new `artist_profile` row inside the supplied transaction handle.
 * Used by both `ArtistRegistryService.create` and the submission approve flow
 * so the slug logic stays in one place. Defaults to `status = 'pending'` for
 * non-admin paths; admin callers should pass `status: 'approved'`. */
export async function insertArtistInTx(
  tx: Database,
  creatorUserId: string | null,
  input: CreateArtistInput,
): Promise<ArtistRecord> {
  const slug = await resolveUniqueArtistSlug(tx, input.displayName);
  const kind = input.kind ?? "artist";
  const [row] = await tx
    .insert(artistProfile)
    .values({
      displayName: input.displayName,
      slug,
      kind,
      status: input.status ?? "pending",
      shortBio: input.shortBio ?? null,
      nationality: input.nationality ?? null,
      countryCode: input.countryCode ?? null,
      birthYear: input.birthYear ?? null,
      deathYear: input.deathYear ?? null,
      foundedYear: input.foundedYear ?? null,
      dissolvedYear: input.dissolvedYear ?? null,
      attributes: parseCreatorAttributes(kind, input.attributes),
      createdByUserId: creatorUserId,
      ownerUserId: input.ownerUserId ?? null,
    })
    .returning();
  if (!row) throw new Error("artist_create_failed");
  if (input.categoryIds && input.categoryIds.length > 0) {
    await replaceArtistCategoriesInTx(tx, row.id as string, input.categoryIds);
  }
  return rowToRecord(row);
}
