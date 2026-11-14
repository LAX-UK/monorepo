import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopArtworkInterest,
  shopDocument,
  shopEdition,
  shopOriginalSale,
  shopPayoutLedger,
  shopSaleAuthorityGrant,
  shopSaleAuthorityRequest,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type EditionAuthorityRow,
  ShopDomainError,
  assertAuthorityWithinOwnership,
  authorisablePrintCount,
} from "@auction/shop-domain";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  CreateSaleAuthorityRequestCommand,
  CreateSaleAuthorityRequestResult,
  PortalCollectionItem,
  PortalEnquiryRow,
  PortalOwnedEditionRow,
  PortalOwnershipReader,
  PortalSaleAuthorityRow,
  WithdrawSaleAuthorityRequestResult,
} from "../application/ports/portal-ownership.reader.js";
import { PORTAL_ME_LIST_LIMIT } from "../domain/portal-me-list-limit.js";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../lib/pg-errors.js";
import { printLabelOf, printLabelSelection } from "./edition-runs/print-label.js";
import {
  type PortalPartyScope,
  portalPartyRows,
  resolvePortalPartyScope,
} from "./portal-party-scope.js";
import { resolvePortalPayoutScope } from "./portal-payout-scope.js";
import { createShopDocumentDownloadUrl } from "./shop-document-download-url.js";
import type { ShopDocumentStorageConfig } from "./shop-document-download-url.js";

function saleAuthorityRequestRows(scope: PortalPartyScope) {
  return portalPartyRows(
    scope,
    shopSaleAuthorityRequest.ownerPartyId,
    shopSaleAuthorityRequest.artworkId,
  );
}

export function createDrizzlePortalOwnershipRepository(
  db: Database,
  options?: { documentStorage?: ShopDocumentStorageConfig | null },
): PortalOwnershipReader {
  const documentStorage = options?.documentStorage ?? null;
  return {
    async listOwnedEditions(identitySubjectId: string): Promise<PortalOwnedEditionRow[]> {
      const scope = await resolvePortalPartyScope(db, identitySubjectId);
      const owned = portalPartyRows(scope, shopEdition.ownerPartyId, shopEdition.artworkId);
      if (!owned) {
        return [];
      }
      const rows = await db
        .select({
          editionId: shopEdition.id,
          artworkId: shopArtwork.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          print: printLabelSelection,
          listingStatus: shopEdition.listingStatus,
          custodyStatus: shopEdition.custodyStatus,
          salesChannel: shopArtwork.salesChannel,
        })
        .from(shopEdition)
        .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
        .where(owned)
        .orderBy(shopArtwork.title, shopEdition.editionNumber)
        .limit(PORTAL_ME_LIST_LIMIT);
      return rows.map(({ print, ...row }) => ({ ...row, printLabel: printLabelOf(print) }));
    },

    async listSaleAuthority(identitySubjectId: string): Promise<PortalSaleAuthorityRow[]> {
      const scope = await resolvePortalPartyScope(db, identitySubjectId);
      const owned = portalPartyRows(scope, shopEdition.ownerPartyId, shopEdition.artworkId);
      const grants = portalPartyRows(
        scope,
        shopSaleAuthorityGrant.ownerPartyId,
        shopSaleAuthorityGrant.artworkId,
      );
      if (!owned || !grants) {
        return [];
      }
      const ownedPairs = await db
        .selectDistinct({
          artworkId: shopEdition.artworkId,
          ownerPartyId: shopEdition.ownerPartyId,
        })
        .from(shopEdition)
        .where(owned);
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
          ownedCount: sql<number>`count(*) filter (where ${shopEdition.listingStatus} <> 'withdrawn')`,
        })
        .from(shopEdition)
        .where(and(owned, inArray(shopEdition.artworkId, artworkIds)))
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
        .where(and(grants, inArray(shopSaleAuthorityGrant.artworkId, artworkIds)))
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
            ownedCount: Number(row.ownedCount),
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
          ownedCount: 0,
        };
        const grant = grantByArtworkOwner.get(key);
        rows.push({
          artworkId: artwork.id,
          artworkSlug: artwork.slug,
          artworkTitle: artwork.title,
          ownerPartyId: pair.ownerPartyId,
          authorisedCount: stats.authorisedCount,
          committedCount: stats.committedCount,
          ownedCount: stats.ownedCount,
          lastGrantAt: grant?.createdAt.toISOString() ?? null,
        });
      }
      rows.sort((a, b) => a.artworkTitle.localeCompare(b.artworkTitle));
      return rows;
    },

    async createSaleAuthorityRequest(
      command: CreateSaleAuthorityRequestCommand,
    ): Promise<CreateSaleAuthorityRequestResult> {
      if (!Number.isInteger(command.requestedCount) || command.requestedCount < 0) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Requested count must be a whole number, 0 or more",
          400,
        );
      }
      const scope = await resolvePortalPartyScope(db, command.identitySubjectId);
      const owned = portalPartyRows(scope, shopEdition.ownerPartyId, shopEdition.artworkId);
      if (!owned) {
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
        .where(and(eq(shopEdition.artworkId, command.artworkId), owned));
      if (owningParties.length === 0) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FORBIDDEN,
          "You do not own editions on this artwork",
          403,
        );
      }
      const identityPartyId = scope.ownPartyId;
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

      // Rule 14: an owner can ask to sell at most the prints they hold that are not yet taken.
      const ownedRows = await db
        .select({
          stockRef: shopEdition.stockRef,
          listingStatus: shopEdition.listingStatus,
          custodyStatus: shopEdition.custodyStatus,
        })
        .from(shopEdition)
        .where(
          and(
            eq(shopEdition.artworkId, command.artworkId),
            eq(shopEdition.ownerPartyId, ownerPartyId),
          ),
        );
      try {
        assertAuthorityWithinOwnership(
          command.requestedCount,
          authorisablePrintCount(ownedRows as EditionAuthorityRow[]),
        );
      } catch (error) {
        if (error instanceof ShopDomainError) {
          throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, error.message, 400);
        }
        throw error;
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
      const scope = await resolvePortalPayoutScope(db, identitySubjectId);
      if (!scope) {
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
        .where(scope)
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
      const requests = saleAuthorityRequestRows(
        await resolvePortalPartyScope(db, identitySubjectId),
      );
      if (!requests) {
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
          declineReason: shopSaleAuthorityRequest.declineReason,
          status: shopSaleAuthorityRequest.status,
          createdAt: shopSaleAuthorityRequest.createdAt,
          handledAt: shopSaleAuthorityRequest.handledAt,
        })
        .from(shopSaleAuthorityRequest)
        .innerJoin(shopArtwork, eq(shopSaleAuthorityRequest.artworkId, shopArtwork.id))
        .where(requests)
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
        declineReason: row.declineReason ?? null,
      }));
    },

    async withdrawSaleAuthorityRequest(
      identitySubjectId: string,
      requestId: string,
    ): Promise<WithdrawSaleAuthorityRequestResult> {
      const requests = saleAuthorityRequestRows(
        await resolvePortalPartyScope(db, identitySubjectId),
      );
      if (!requests) {
        throw notFound("Sale authority request");
      }
      // One conditional update, so a staff decision landing at the same moment wins or loses cleanly.
      const [cancelled] = await db
        .update(shopSaleAuthorityRequest)
        .set({ status: "cancelled", handledAt: new Date() })
        .where(
          and(
            eq(shopSaleAuthorityRequest.id, requestId),
            requests,
            eq(shopSaleAuthorityRequest.status, "pending"),
          ),
        )
        .returning({ id: shopSaleAuthorityRequest.id });
      if (cancelled) {
        return { requestId: cancelled.id, status: "cancelled" };
      }
      const [existing] = await db
        .select({ id: shopSaleAuthorityRequest.id })
        .from(shopSaleAuthorityRequest)
        .where(and(eq(shopSaleAuthorityRequest.id, requestId), requests))
        .limit(1);
      if (!existing) {
        throw notFound("Sale authority request");
      }
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "This request has already been decided",
        409,
      );
    },

    async listCollection(identitySubjectId: string): Promise<PortalCollectionItem[]> {
      const scope = await resolvePortalPartyScope(db, identitySubjectId);
      const owned = portalPartyRows(scope, shopEdition.ownerPartyId, shopEdition.artworkId);
      const bought = portalPartyRows(
        scope,
        shopOriginalSale.buyerPartyId,
        shopOriginalSale.artworkId,
      );
      if (!owned || !bought) {
        return [];
      }
      const editions = await db
        .select({
          editionId: shopEdition.id,
          artworkId: shopArtwork.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          print: printLabelSelection,
          listingStatus: shopEdition.listingStatus,
          custodyStatus: shopEdition.custodyStatus,
          salesChannel: shopArtwork.salesChannel,
        })
        .from(shopEdition)
        .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
        .where(owned)
        .orderBy(shopArtwork.title, shopEdition.editionNumber)
        .limit(PORTAL_ME_LIST_LIMIT);

      const originals = await db
        .select({
          originalSaleId: shopOriginalSale.id,
          artworkId: shopArtwork.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          salesChannel: shopOriginalSale.salesChannel,
          status: shopOriginalSale.status,
          acquiredAt: shopOriginalSale.updatedAt,
        })
        .from(shopOriginalSale)
        .innerJoin(shopArtwork, eq(shopOriginalSale.artworkId, shopArtwork.id))
        .where(and(bought, eq(shopOriginalSale.status, "assigned")))
        .orderBy(desc(shopOriginalSale.updatedAt))
        .limit(PORTAL_ME_LIST_LIMIT);

      const items: PortalCollectionItem[] = [
        ...originals.map((row) => ({
          kind: "original" as const,
          originalSaleId: row.originalSaleId,
          artworkId: row.artworkId,
          artworkSlug: row.artworkSlug,
          artworkTitle: row.artworkTitle,
          salesChannel: row.salesChannel,
          status: row.status,
          acquiredAt: row.acquiredAt.toISOString(),
        })),
        ...editions.map((row) => ({
          kind: "edition" as const,
          editionId: row.editionId,
          artworkId: row.artworkId,
          artworkSlug: row.artworkSlug,
          artworkTitle: row.artworkTitle,
          salesChannel: row.salesChannel,
          printLabel: printLabelOf(row.print),
          listingStatus: row.listingStatus,
          custodyStatus: row.custodyStatus,
        })),
      ];
      return items;
    },

    async listEnquiries(identitySubjectId: string): Promise<PortalEnquiryRow[]> {
      const rows = await db
        .select({
          enquiryId: shopArtworkInterest.id,
          artworkId: shopArtwork.id,
          artworkSlug: shopArtwork.slug,
          artworkTitle: shopArtwork.title,
          salesChannel: shopArtwork.salesChannel,
          intent: shopArtworkInterest.intent,
          message: shopArtworkInterest.message,
          contactPhone: shopArtworkInterest.contactPhone,
          createdAt: shopArtworkInterest.createdAt,
          notifiedAt: shopArtworkInterest.notifiedAt,
        })
        .from(shopArtworkInterest)
        .innerJoin(shopArtwork, eq(shopArtworkInterest.artworkId, shopArtwork.id))
        .where(
          and(
            eq(shopArtworkInterest.identitySubjectId, identitySubjectId),
            eq(shopArtworkInterest.intent, "enquiry"),
          ),
        )
        .orderBy(desc(shopArtworkInterest.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);
      return rows.map((row) => ({
        enquiryId: row.enquiryId,
        artworkId: row.artworkId,
        artworkSlug: row.artworkSlug,
        artworkTitle: row.artworkTitle,
        salesChannel: row.salesChannel,
        intent: row.intent,
        status: row.notifiedAt ? "staff_notified" : "open",
        message: row.message,
        contactPhone: row.contactPhone,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async listDocuments(identitySubjectId: string) {
      // Documents carry no artwork, so only parties the person owns are read.
      const documents = portalPartyRows(
        await resolvePortalPartyScope(db, identitySubjectId),
        shopDocument.partyId,
        null,
      );
      if (!documents) {
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
        .where(and(documents, eq(shopDocument.visibility, "client")))
        .orderBy(desc(shopDocument.createdAt))
        .limit(PORTAL_ME_LIST_LIMIT);
      return Promise.all(
        rows.map(async (row) => ({
          documentId: row.documentId,
          kind: row.kind,
          createdAt: row.createdAt.toISOString(),
          downloadUrl: await createShopDocumentDownloadUrl(documentStorage, row.objectKey),
        })),
      );
    },
  };
}
