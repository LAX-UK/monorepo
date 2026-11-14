import type { Database } from "@auction/db";
import { shopArtist, shopParty } from "@auction/db/schema";
import { type SQL, and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * The parties a signed-in person acts for in the seller portal and their data export.
 *
 * One rule for every portal reader:
 *
 * - A party the person owns is theirs in full. They own their own party (the one their sign-in is
 *   linked to, `shop_party.identity_subject_id`). They also own the party behind their artist
 *   profile when it is that party, or when the party is unclaimed (no sign-in linked) and no other
 *   artist profile uses it: the seller party created for them as an artist.
 * - An artist profile on any other party (a gallery's own party, or one shared by several artists)
 *   grants only rows tied to that artist's own artworks. Rows with no artwork are left out.
 */
export type PortalPartyScope = {
  /** The person's own party, the only one a payout account may be created on. */
  ownPartyId: string | null;
  /** Parties the person sees in full. */
  ownedPartyIds: string[];
  /** An artist profile on a party the person does not own: rows on that artist's artworks only. */
  artistOnSharedParty: { artistId: string; partyId: string } | null;
};

export async function resolvePortalPartyScope(
  db: Database,
  identitySubjectId: string,
): Promise<PortalPartyScope> {
  const [[ownParty], [artist]] = await Promise.all([
    db
      .select({ id: shopParty.id })
      .from(shopParty)
      .where(eq(shopParty.identitySubjectId, identitySubjectId))
      .limit(1),
    db
      .select({ id: shopArtist.id, partyId: shopArtist.partyId })
      .from(shopArtist)
      .where(eq(shopArtist.identitySubjectId, identitySubjectId))
      .limit(1),
  ]);

  const ownPartyId = ownParty?.id ?? null;
  const ownedPartyIds = ownPartyId ? [ownPartyId] : [];
  let artistOnSharedParty: PortalPartyScope["artistOnSharedParty"] = null;
  if (artist && artist.partyId !== ownPartyId) {
    const [[party], otherArtists] = await Promise.all([
      db
        .select({ identitySubjectId: shopParty.identitySubjectId })
        .from(shopParty)
        .where(eq(shopParty.id, artist.partyId))
        .limit(1),
      db
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(and(eq(shopArtist.partyId, artist.partyId), ne(shopArtist.id, artist.id)))
        .limit(1),
    ]);
    if (party && party.identitySubjectId === null && otherArtists.length === 0) {
      ownedPartyIds.push(artist.partyId);
    } else {
      artistOnSharedParty = { artistId: artist.id, partyId: artist.partyId };
    }
  }
  return { ownPartyId, ownedPartyIds, artistOnSharedParty };
}

export function isEmptyPortalPartyScope(scope: PortalPartyScope): boolean {
  return scope.ownedPartyIds.length === 0 && scope.artistOnSharedParty === null;
}

/**
 * The rows of a party-owned table the person may see under the rule above. `artworkId` is the
 * artwork the row is about, or null when the row has none. `artistRow` narrows the artist grant
 * further (for example to rows owed to the artist). Null when nothing is visible.
 */
export function portalPartyRows(
  scope: PortalPartyScope,
  partyId: AnyPgColumn,
  artworkId: AnyPgColumn | SQL | null,
  artistRow?: SQL,
): SQL | null {
  const grants: SQL[] = [];
  if (scope.ownedPartyIds.length > 0) {
    grants.push(inArray(partyId, scope.ownedPartyIds));
  }
  const shared = scope.artistOnSharedParty;
  if (shared && artworkId !== null) {
    const artistRows = and(
      eq(partyId, shared.partyId),
      sql`exists (select 1 from shop_artwork pa where pa.id = ${artworkId} and pa.artist_id = ${shared.artistId})`,
      artistRow,
    );
    if (artistRows) grants.push(artistRows);
  }
  if (grants.length === 0) return null;
  return grants.length === 1 ? (grants[0] as SQL) : (or(...grants) as SQL);
}
