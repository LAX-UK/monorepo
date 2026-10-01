import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopDocument,
  shopEdition,
  shopParty,
  shopPayoutLedger,
  shopSaleAuthorityGrant,
  shopSaleAuthorityRequest,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  CreateSaleAuthorityRequestCommand,
  CreateSaleAuthorityRequestResult,
  PortalOwnedEditionRow,
  PortalOwnershipReader,
  PortalSaleAuthorityRow,
} from "../application/ports/portal-ownership.reader.js";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";

async function tryResolveOwnerPartyId(
  db: Database,
  identitySubjectId: string,
): Promise<string | null> {
  const [party] = await db
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, identitySubjectId))
    .limit(1);
  return party?.id ?? null;
}

async function resolveOwnerPartyId(db: Database, identitySubjectId: string): Promise<string> {
  const ownerPartyId = await tryResolveOwnerPartyId(db, identitySubjectId);
  if (!ownerPartyId) {
    throw notFound("Owner party");
  }
  return ownerPartyId;
}

export function createDrizzlePortalOwnershipRepository(db: Database): PortalOwnershipReader {
  return {
    async listOwnedEditions(identitySubjectId: string): Promise<PortalOwnedEditionRow[]> {
      const ownerPartyId = await tryResolveOwnerPartyId(db, identitySubjectId);
      if (!ownerPartyId) {
        return [];
      }
      const rows = await db
        .select({
          editionId: shopEdition.id,
          artworkId: shopArtwork.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          editionNumber: shopEdition.editionNumber,
          listingStatus: shopEdition.listingStatus,
          custodyStatus: shopEdition.custodyStatus,
        })
        .from(shopEdition)
        .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
        .where(eq(shopEdition.ownerPartyId, ownerPartyId))
        .orderBy(shopArtwork.title, shopEdition.editionNumber);
      return rows;
    },

    async listSaleAuthority(identitySubjectId: string): Promise<PortalSaleAuthorityRow[]> {
      const ownerPartyId = await tryResolveOwnerPartyId(db, identitySubjectId);
      if (!ownerPartyId) {
        return [];
      }
      const ownedArtworkIds = await db
        .selectDistinct({ artworkId: shopEdition.artworkId })
        .from(shopEdition)
        .where(eq(shopEdition.ownerPartyId, ownerPartyId));
      if (ownedArtworkIds.length === 0) {
        return [];
      }
      const artworkIds = ownedArtworkIds.map((row) => row.artworkId);
      const artworks = await db
        .select({
          id: shopArtwork.id,
          slug: shopArtwork.slug,
          title: shopArtwork.title,
        })
        .from(shopArtwork)
        .where(inArray(shopArtwork.id, artworkIds));

      const editionStats = await db
        .select({
          artworkId: shopEdition.artworkId,
          authorisedCount: sql<number>`count(*) filter (where ${shopEdition.listingStatus} = 'authorised')`,
          committedCount: sql<number>`count(*) filter (where ${shopEdition.listingStatus} in ('reserved', 'held', 'sold'))`,
        })
        .from(shopEdition)
        .where(
          and(
            eq(shopEdition.ownerPartyId, ownerPartyId),
            inArray(shopEdition.artworkId, artworkIds),
          ),
        )
        .groupBy(shopEdition.artworkId);

      const latestGrants = await db
        .select({
          artworkId: shopSaleAuthorityGrant.artworkId,
          authorisedCount: shopSaleAuthorityGrant.authorisedCount,
          createdAt: shopSaleAuthorityGrant.createdAt,
          revision: shopSaleAuthorityGrant.revision,
        })
        .from(shopSaleAuthorityGrant)
        .where(
          and(
            eq(shopSaleAuthorityGrant.ownerPartyId, ownerPartyId),
            inArray(shopSaleAuthorityGrant.artworkId, artworkIds),
          ),
        )
        .orderBy(desc(shopSaleAuthorityGrant.revision), desc(shopSaleAuthorityGrant.id));

      const grantByArtwork = new Map<string, { authorisedCount: number; createdAt: Date }>();
      for (const grant of latestGrants) {
        if (!grantByArtwork.has(grant.artworkId)) {
          grantByArtwork.set(grant.artworkId, {
            authorisedCount: grant.authorisedCount,
            createdAt: grant.createdAt,
          });
        }
      }

      const statsByArtwork = new Map(
        editionStats.map((row) => [
          row.artworkId,
          {
            authorisedCount: Number(row.authorisedCount),
            committedCount: Number(row.committedCount),
          },
        ]),
      );

      return artworks.map((artwork) => {
        const stats = statsByArtwork.get(artwork.id) ?? {
          authorisedCount: 0,
          committedCount: 0,
        };
        const grant = grantByArtwork.get(artwork.id);
        return {
          artworkId: artwork.id,
          artworkSlug: artwork.slug,
          artworkTitle: artwork.title,
          ownerPartyId,
          authorisedCount: stats.authorisedCount,
          committedCount: stats.committedCount,
          lastGrantAt: grant?.createdAt.toISOString() ?? null,
        };
      });
    },

    async createSaleAuthorityRequest(
      command: CreateSaleAuthorityRequestCommand,
    ): Promise<CreateSaleAuthorityRequestResult> {
      if (command.requestedCount < 0 || command.requestedCount > 10) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Requested count must be between 0 and 10",
          400,
        );
      }
      const ownerPartyId = await resolveOwnerPartyId(db, command.identitySubjectId);
      const [artwork] = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, command.artworkId))
        .limit(1);
      if (!artwork) {
        throw notFound("Artwork");
      }
      const ownsEdition = await db
        .select({ id: shopEdition.id })
        .from(shopEdition)
        .where(
          and(
            eq(shopEdition.artworkId, command.artworkId),
            eq(shopEdition.ownerPartyId, ownerPartyId),
          ),
        )
        .limit(1);
      if (!ownsEdition[0]) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FORBIDDEN,
          "You do not own editions on this artwork",
          403,
        );
      }

      const [request] = await db
        .insert(shopSaleAuthorityRequest)
        .values({
          artworkId: command.artworkId,
          ownerPartyId,
          requestedCount: command.requestedCount,
          note: command.note ?? null,
          status: "pending",
        })
        .returning({ id: shopSaleAuthorityRequest.id });

      if (!request) {
        throw new Error("Failed to create sale authority request");
      }

      return { requestId: request.id, status: "pending" };
    },

    async listPayouts(identitySubjectId: string) {
      const ownerPartyId = await resolveOwnerPartyId(db, identitySubjectId);
      const rows = await db
        .select({
          payoutId: shopPayoutLedger.id,
          grossPence: shopPayoutLedger.grossPence,
          deductionsPence: shopPayoutLedger.deductionsPence,
          netPence: shopPayoutLedger.netPence,
          status: shopPayoutLedger.status,
          payoutDueAt: shopPayoutLedger.payoutDueAt,
          paidAt: shopPayoutLedger.paidAt,
        })
        .from(shopPayoutLedger)
        .where(eq(shopPayoutLedger.ownerPartyId, ownerPartyId))
        .orderBy(desc(shopPayoutLedger.createdAt));
      return rows.map((row) => ({
        payoutId: row.payoutId,
        grossPence: row.grossPence,
        deductionsPence: row.deductionsPence,
        netPence: row.netPence,
        status: row.status,
        payoutDueAt: row.payoutDueAt.toISOString(),
        paidAt: row.paidAt?.toISOString() ?? null,
      }));
    },

    async listDocuments(identitySubjectId: string) {
      const ownerPartyId = await resolveOwnerPartyId(db, identitySubjectId);
      const rows = await db
        .select({
          documentId: shopDocument.id,
          kind: shopDocument.kind,
          createdAt: shopDocument.createdAt,
          objectKey: shopDocument.objectKey,
          visibility: shopDocument.visibility,
        })
        .from(shopDocument)
        .where(and(eq(shopDocument.partyId, ownerPartyId), eq(shopDocument.visibility, "client")))
        .orderBy(desc(shopDocument.createdAt));
      return rows.map((row) => ({
        documentId: row.documentId,
        kind: row.kind,
        createdAt: row.createdAt.toISOString(),
        downloadUrl: null,
      }));
    },
  };
}
