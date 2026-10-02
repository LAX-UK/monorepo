import type { Database } from "@auction/db";
import { shopArtwork, shopEdition, shopParty, shopSaleAuthorityGrant } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  GrantSaleAuthorityCommand,
  GrantSaleAuthorityResult,
} from "../../application/ports/sale-authority.writer.js";

/** Populated portal acceptance fixture artwork (foundation catalogue). */
export const SHOP_ACCEPTANCE_OWNED_ARTWORK_SLUG = "vessel-study";
export const SHOP_ACCEPTANCE_OWNED_ARTWORK_TITLE = "Vessel Study";

const SEED_OPERATOR = "seed:acceptance-portal";

async function upsertAcceptanceParty(
  db: Database,
  identitySubjectId: string,
  displayName: string,
): Promise<string> {
  const existing = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, identitySubjectId))
    .limit(1);
  if (existing[0]) {
    await db.update(shopParty).set({ displayName }).where(eq(shopParty.id, existing[0].id));
    return existing[0].id;
  }
  const [inserted] = await db
    .insert(shopParty)
    .values({
      displayName,
      identitySubjectId,
      kind: "person",
    })
    .returning({ id: shopParty.id });
  if (!inserted) {
    throw new Error("Failed to create acceptance portal party");
  }
  return inserted.id;
}

/**
 * Idempotent portal fixtures for staging acceptance: one owned edition and sale authority
 * for the acceptance identity subject.
 */
export async function seedAcceptancePortalFixtures(
  db: Database,
  grantSaleAuthority: (command: GrantSaleAuthorityCommand) => Promise<GrantSaleAuthorityResult>,
  options: {
    identitySubjectId: string;
    displayName?: string;
  },
): Promise<void> {
  const identitySubjectId = options.identitySubjectId.trim();
  if (!identitySubjectId) {
    throw new Error("identitySubjectId is required for acceptance portal seed");
  }
  const displayName = options.displayName?.trim() || "Shop acceptance portal";
  const ownerPartyId = await upsertAcceptanceParty(db, identitySubjectId, displayName);

  const artworkRows = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_OWNED_ARTWORK_SLUG))
    .limit(1);
  const artworkId = artworkRows[0]?.id;
  if (!artworkId) {
    throw new Error(
      `Acceptance portal seed requires artwork ${SHOP_ACCEPTANCE_OWNED_ARTWORK_SLUG}; run catalogue seed first`,
    );
  }

  const editions = await db
    .select({
      id: shopEdition.id,
      editionNumber: shopEdition.editionNumber,
    })
    .from(shopEdition)
    .where(eq(shopEdition.artworkId, artworkId))
    .orderBy(shopEdition.editionNumber);

  if (editions.length < 2) {
    throw new Error("Acceptance portal seed requires at least two editions on vessel-study");
  }

  const ownedEdition = editions[0];
  const authorityEdition = editions[1];
  if (!ownedEdition || !authorityEdition) {
    throw new Error("Acceptance portal seed requires two distinct editions on vessel-study");
  }

  await db
    .update(shopEdition)
    .set({
      ownerPartyId,
      listingStatus: "sold",
      custodyStatus: "with_owner",
    })
    .where(eq(shopEdition.id, ownedEdition.id));

  const [existingGrant] = await db
    .select({ id: shopSaleAuthorityGrant.id })
    .from(shopSaleAuthorityGrant)
    .where(
      and(
        eq(shopSaleAuthorityGrant.artworkId, artworkId),
        eq(shopSaleAuthorityGrant.ownerPartyId, ownerPartyId),
      ),
    )
    .limit(1);

  if (!existingGrant) {
    await db
      .update(shopEdition)
      .set({
        ownerPartyId,
        listingStatus: "not_authorised",
        custodyStatus: "unprinted",
      })
      .where(eq(shopEdition.id, authorityEdition.id));

    await grantSaleAuthority({
      artworkId,
      ownerPartyId,
      authorisedCount: 1,
      recordedBySubjectId: SEED_OPERATOR,
      evidenceNote: "Shop acceptance portal seed",
    });
  } else {
    await db
      .update(shopEdition)
      .set({ ownerPartyId })
      .where(eq(shopEdition.id, authorityEdition.id));
  }
}
