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
import { PORTAL_ME_LIST_LIMIT } from "../domain/portal-me-list-limit.js";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../lib/pg-errors.js";
import { resolvePortalPartyIds } from "./portal-party-ids.js";

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

export function createDrizzlePortalOwnershipRepository(db: Database): PortalOwnershipReader {
  return {
    async listOwnedEditions(identitySubjectId: string): Promise<PortalOwnedEditionRow[]> {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      if (partyIds.length === 0) {
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
        .where(inArray(shopEdition.ownerPartyId, partyIds))
        .orderBy(shopArtwork.title, shopEdition.editionNumber)
        .limit(PORTAL_ME_LIST_LIMIT);
      return rows;
    },

    async listSaleAuthority(identitySubjectId: string): Promise<PortalSaleAuthorityRow[]> {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      if (partyIds.length === 0) {
        return [];
      }
      const ownedPairs = await db
        .selectDistinct({
          artworkId: shopEdition.artworkId,
          ownerPartyId: shopEdition.ownerPartyId,
        })
        .from(shopEdition)
        .where(inArray(shopEdition.ownerPartyId, partyIds));
      if (ownedPairs.length === 0) {
        return [];
      }
      const artworkIds = [...new Set(ownedPairs.map((row) => row.artworkId))];
      const artworks = await db
        .select({
          id: shopArtwork.id,
          slug: shopArtwork.slug,
          title: shopArtwork.title,
        })
        .from(shopArtwork)
        .where(inArray(shopArtwork.id, artworkIds));
      const artworkById = new Map(artworks.map((artwork) => [artwork.id, artwork]));

      const editionStats = await db
        .select({
          artworkId: shopEdition.artworkId,
          ownerPartyId: shopEdition.ownerPartyId,
          authorisedCount: sql<number>`count(*) filter (where ${shopEdition.listingStatus} = 'authorised')`,
          committedCount: sql<number>`count(*) filter (where ${shopEdition.listingStatus} in ('reserved', 'held', 'sold'))`,
        })
        .from(shopEdition)
        .where(
          and(
            inArray(shopEdition.ownerPartyId, partyIds),
            inArray(shopEdition.artworkId, artworkIds),
          ),
        )
        .groupBy(shopEdition.artworkId, shopEdition.ownerPartyId);

      const latestGrants = await db
        .select({
          artworkId: shopSaleAuthorityGrant.artworkId,
          authorisedCount: shopSaleAuthorityGrant.authorisedCount,
          createdAt: shopSaleAuthorityGrant.createdAt,
          revision: shopSaleAuthorityGrant.revision,
          ownerPartyId: shopSaleAuthorityGrant.ownerPartyId,
        })
        .from(shopSaleAuthorityGrant)
        .where(
          and(
            inArray(shopSaleAuthorityGrant.ownerPartyId, partyIds),
            inArray(shopSaleAuthorityGrant.artworkId, artworkIds),
          ),
        )
        .orderBy(desc(shopSaleAuthorityGrant.revision), desc(shopSaleAuthorityGrant.id));

      const grantByArtworkOwner = new Map<string, { createdAt: Date }>();
      for (const grant of latestGrants) {
        const key = `${grant.artworkId}:${grant.ownerPartyId}`;
        if (!grantByArtworkOwner.has(key)) {
          grantByArtworkOwner.set(key, { createdAt: grant.createdAt });
        }
      }

      const statsByArtworkOwner = new Map(
        editionStats.map((row) => [
          `${row.artworkId}:${row.ownerPartyId}`,
          {
            authorisedCount: Number(row.authorisedCount),
            committedCount: Number(row.committedCount),
          },
        ]),
      );

      const rows: PortalSaleAuthorityRow[] = [];
      for (const pair of ownedPairs) {
        if (!pair.ownerPartyId) {
          continue;
        }
        const artwork = artworkById.get(pair.artworkId);
        if (!artwork) {
          continue;
        }
        const key = `${pair.artworkId}:${pair.ownerPartyId}`;
        const stats = statsByArtworkOwner.get(key) ?? {
          authorisedCount: 0,
          committedCount: 0,
        };
        const grant = grantByArtworkOwner.get(key);
        rows.push({
          artworkId: artwork.id,
          artworkSlug: artwork.slug,
          artworkTitle: artwork.title,
          ownerPartyId: pair.ownerPartyId,
          authorisedCount: stats.authorisedCount,
          committedCount: stats.committedCount,
          lastGrantAt: grant?.createdAt.toISOString() ?? null,
        });
      }
      rows.sort((a, b) => a.artworkTitle.localeCompare(b.artworkTitle));
      return rows;
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
      const partyIds = await resolvePortalPartyIds(db, command.identitySubjectId);
      if (partyIds.length === 0) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FORBIDDEN,
          "You do not own editions on this artwork",
          403,
        );
      }
      const [artwork] = await db
        .select({ id: shopArtwork.id })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, command.artworkId))
        .limit(1);
      if (!artwork) {
        throw notFound("Artwork");
      }
      const owningParties = await db
        .selectDistinct({ ownerPartyId: shopEdition.ownerPartyId })
        .from(shopEdition)
        .where(
          and(
            eq(shopEdition.artworkId, command.artworkId),
            inArray(shopEdition.ownerPartyId, partyIds),
          ),
        );
      if (owningParties.length === 0) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FORBIDDEN,
          "You do not own editions on this artwork",
          403,
        );
      }
      const identityPartyId = await tryResolveOwnerPartyId(db, command.identitySubjectId);
      const matchedOwner =
        identityPartyId != null
          ? owningParties.find((row) => row.ownerPartyId === identityPartyId)
          : undefined;
      const ownerPartyId = matchedOwner?.ownerPartyId ?? owningParties[0]?.ownerPartyId;
      if (!ownerPartyId) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FORBIDDEN,
          "You do not own editions on this artwork",
          403,
        );
      }

      const [existingPending] = await db
        .select({ id: shopSaleAuthorityRequest.id })
        .from(shopSaleAuthorityRequest)
        .where(
          and(
            eq(shopSaleAuthorityRequest.artworkId, command.artworkId),
            eq(shopSaleAuthorityRequest.ownerPartyId, ownerPartyId),
            eq(shopSaleAuthorityRequest.status, "pending"),
          ),
        )
        .limit(1);
      if (existingPending) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "A pending request already exists for this artwork",
          409,
        );
      }

      try {
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
      } catch (error) {
        if (isPgUniqueViolation(error)) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "A pending request already exists for this artwork",
            409,
          );
        }
        throw error;
      }
    },

    async listPayouts(identitySubjectId: string) {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      if (partyIds.length === 0) {
        return [];
      }
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
        .where(inArray(shopPayoutLedger.ownerPartyId, partyIds))
        .orderBy(desc(shopPayoutLedger.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);
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

    async listSaleAuthorityRequests(identitySubjectId: string) {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      if (partyIds.length === 0) {
        return [];
      }
      const rows = await db
        .select({
          requestId: shopSaleAuthorityRequest.id,
          artworkId: shopArtwork.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          requestedCount: shopSaleAuthorityRequest.requestedCount,
          note: shopSaleAuthorityRequest.note,
          status: shopSaleAuthorityRequest.status,
          createdAt: shopSaleAuthorityRequest.createdAt,
          handledAt: shopSaleAuthorityRequest.handledAt,
        })
        .from(shopSaleAuthorityRequest)
        .innerJoin(shopArtwork, eq(shopSaleAuthorityRequest.artworkId, shopArtwork.id))
        .where(inArray(shopSaleAuthorityRequest.ownerPartyId, partyIds))
        .orderBy(desc(shopSaleAuthorityRequest.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);
      return rows.map((row) => ({
        requestId: row.requestId,
        artworkId: row.artworkId,
        artworkSlug: row.artworkSlug,
        artworkTitle: row.artworkTitle,
        requestedCount: row.requestedCount,
        note: row.note,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        handledAt: row.handledAt?.toISOString() ?? null,
      }));
    },

    async listDocuments(identitySubjectId: string) {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      if (partyIds.length === 0) {
        return [];
      }
      const rows = await db
        .select({
          documentId: shopDocument.id,
          kind: shopDocument.kind,
          createdAt: shopDocument.createdAt,
          objectKey: shopDocument.objectKey,
          visibility: shopDocument.visibility,
        })
        .from(shopDocument)
        .where(and(inArray(shopDocument.partyId, partyIds), eq(shopDocument.visibility, "client")))
        .orderBy(desc(shopDocument.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);
      return rows.map((row) => ({
        documentId: row.documentId,
        kind: row.kind,
        createdAt: row.createdAt.toISOString(),
        downloadUrl: null,
      }));
    },
  };
}
