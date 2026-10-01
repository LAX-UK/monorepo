import type { Database } from "@auction/db";
import {
  shopAdminAudit,
  shopArtwork,
  shopEdition,
  shopSaleAuthorityGrant,
  shopSaleAuthorityRequest,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type EditionAuthorityRow,
  ShopDomainError,
  assertAuthorityReductionAllowed,
  selectEditionsToAuthorise,
  selectEditionsToRevokeAuthority,
} from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type {
  GrantSaleAuthorityCommand,
  GrantSaleAuthorityResult,
  SaleAuthorityWriter,
} from "../application/ports/sale-authority.writer.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { notFound } from "../errors/shop-api-error.js";
import { isPgUniqueViolation, pgUniqueViolationConstraint } from "../lib/pg-errors.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

export function createDrizzleSaleAuthorityWriter(
  db: Database,
  domainEventMode: "off" | "observe" | "enforce",
): SaleAuthorityWriter {
  const events = createShopDomainEventPublisher(domainEventMode);

  return {
    async grantSaleAuthority(
      command: GrantSaleAuthorityCommand,
    ): Promise<GrantSaleAuthorityResult> {
      try {
        return await db.transaction(async (tx) => {
          if (command.requestId) {
            const [existing] = await tx
              .select({
                id: shopSaleAuthorityGrant.id,
                artworkId: shopSaleAuthorityGrant.artworkId,
                ownerPartyId: shopSaleAuthorityGrant.ownerPartyId,
                authorisedCount: shopSaleAuthorityGrant.authorisedCount,
              })
              .from(shopSaleAuthorityGrant)
              .where(eq(shopSaleAuthorityGrant.requestId, command.requestId))
              .limit(1);
            if (existing) {
              if (
                existing.artworkId === command.artworkId &&
                existing.ownerPartyId === command.ownerPartyId &&
                existing.authorisedCount === command.authorisedCount
              ) {
                return {
                  grantId: existing.id,
                  artworkId: existing.artworkId,
                  ownerPartyId: existing.ownerPartyId,
                  authorisedCount: existing.authorisedCount,
                  editionNumbersAuthorised: [],
                  editionNumbersRevoked: [],
                };
              }
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.CONFLICT,
                "Sale authority request idempotency mismatch",
                409,
              );
            }
            const [request] = await tx
              .select({
                id: shopSaleAuthorityRequest.id,
                status: shopSaleAuthorityRequest.status,
              })
              .from(shopSaleAuthorityRequest)
              .where(
                and(
                  eq(shopSaleAuthorityRequest.id, command.requestId),
                  eq(shopSaleAuthorityRequest.artworkId, command.artworkId),
                  eq(shopSaleAuthorityRequest.ownerPartyId, command.ownerPartyId),
                ),
              )
              .limit(1);
            if (!request || request.status !== "pending") {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.CONFLICT,
                "Sale authority request is not pending",
                409,
              );
            }
          }
          const [artwork] = await tx
            .select({ id: shopArtwork.id })
            .from(shopArtwork)
            .where(eq(shopArtwork.id, command.artworkId))
            .limit(1);
          if (!artwork) {
            throw notFound("Artwork");
          }

          const ownedRows = await tx
            .select({
              editionNumber: shopEdition.editionNumber,
              listingStatus: shopEdition.listingStatus,
              custodyStatus: shopEdition.custodyStatus,
              id: shopEdition.id,
            })
            .from(shopEdition)
            .where(
              and(
                eq(shopEdition.artworkId, command.artworkId),
                eq(shopEdition.ownerPartyId, command.ownerPartyId),
              ),
            )
            .for("update");

          const authorityRows: EditionAuthorityRow[] = ownedRows.map((row) => ({
            editionNumber: row.editionNumber,
            listingStatus: row.listingStatus as EditionAuthorityRow["listingStatus"],
            custodyStatus: row.custodyStatus as EditionAuthorityRow["custodyStatus"],
          }));

          const currentAuthorised = authorityRows.filter(
            (e) => e.listingStatus === "authorised",
          ).length;
          assertAuthorityReductionAllowed({
            newAuthorisedCount: command.authorisedCount,
          });

          const toAuthorise =
            command.authorisedCount > currentAuthorised
              ? selectEditionsToAuthorise(
                  authorityRows,
                  command.authorisedCount - currentAuthorised,
                )
              : [];
          const toRevoke =
            command.authorisedCount < currentAuthorised
              ? selectEditionsToRevokeAuthority(
                  authorityRows,
                  currentAuthorised - command.authorisedCount,
                )
              : [];

          const increaseNeeded = command.authorisedCount - currentAuthorised;
          if (increaseNeeded > 0 && toAuthorise.length < increaseNeeded) {
            throw new ShopDomainError("Not enough eligible editions to authorise");
          }

          const recordedAuthorisedCount = currentAuthorised - toRevoke.length + toAuthorise.length;

          const now = new Date();
          for (const editionNumber of toAuthorise) {
            await tx
              .update(shopEdition)
              .set({
                listingStatus: "authorised",
                saleAuthorisedAt: now,
              })
              .where(
                and(
                  eq(shopEdition.artworkId, command.artworkId),
                  eq(shopEdition.editionNumber, editionNumber),
                  eq(shopEdition.ownerPartyId, command.ownerPartyId),
                ),
              );
          }
          for (const editionNumber of toRevoke) {
            await tx
              .update(shopEdition)
              .set({
                listingStatus: "not_authorised",
                saleAuthorisedAt: null,
              })
              .where(
                and(
                  eq(shopEdition.artworkId, command.artworkId),
                  eq(shopEdition.editionNumber, editionNumber),
                  eq(shopEdition.ownerPartyId, command.ownerPartyId),
                ),
              );
          }

          const [grant] = await tx
            .insert(shopSaleAuthorityGrant)
            .values({
              artworkId: command.artworkId,
              ownerPartyId: command.ownerPartyId,
              authorisedCount: recordedAuthorisedCount,
              recordedBySubjectId: command.recordedBySubjectId,
              evidenceNote: command.evidenceNote,
              ...(command.requestId ? { requestId: command.requestId } : {}),
            })
            .returning({ id: shopSaleAuthorityGrant.id });

          if (!grant) {
            throw new Error("Failed to record sale authority grant");
          }

          if (command.requestId) {
            const requestUpdated = await tx
              .update(shopSaleAuthorityRequest)
              .set({
                status: "approved",
                handledBySubjectId: command.recordedBySubjectId,
                handledAt: now,
              })
              .where(
                and(
                  eq(shopSaleAuthorityRequest.id, command.requestId),
                  eq(shopSaleAuthorityRequest.artworkId, command.artworkId),
                  eq(shopSaleAuthorityRequest.ownerPartyId, command.ownerPartyId),
                  eq(shopSaleAuthorityRequest.status, "pending"),
                ),
              )
              .returning({ id: shopSaleAuthorityRequest.id });
            if (requestUpdated.length !== 1) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.CONFLICT,
                "Sale authority request could not be approved",
                409,
              );
            }
          }

          await tx.insert(shopAdminAudit).values({
            actorSubjectId: command.recordedBySubjectId,
            capability: "sale_authority.write",
            action: "grant_sale_authority",
            targetType: "shop_artwork",
            targetId: command.artworkId,
            afterJson: JSON.stringify({
              ownerPartyId: command.ownerPartyId,
              authorisedCount: recordedAuthorisedCount,
              editionNumbersAuthorised: toAuthorise,
              editionNumbersRevoked: toRevoke,
            }),
          });

          await events.insertInTransaction(tx, {
            aggregateType: "shop_artwork",
            aggregateId: command.artworkId,
            eventType: "shop.sale_authority.changed",
            producer: "shop-api",
            payload: {
              schemaVersion: 1,
              artworkId: command.artworkId,
              ownerPartyId: command.ownerPartyId,
              authorisedCount: recordedAuthorisedCount,
            },
          });

          return {
            grantId: grant.id,
            artworkId: command.artworkId,
            ownerPartyId: command.ownerPartyId,
            authorisedCount: recordedAuthorisedCount,
            editionNumbersAuthorised: toAuthorise,
            editionNumbersRevoked: toRevoke,
          };
        });
      } catch (err) {
        if (
          isPgUniqueViolation(err) &&
          pgUniqueViolationConstraint(err) === "shop_sale_authority_grant_request_uid" &&
          command.requestId
        ) {
          const [existing] = await db
            .select({
              id: shopSaleAuthorityGrant.id,
              artworkId: shopSaleAuthorityGrant.artworkId,
              ownerPartyId: shopSaleAuthorityGrant.ownerPartyId,
              authorisedCount: shopSaleAuthorityGrant.authorisedCount,
            })
            .from(shopSaleAuthorityGrant)
            .where(eq(shopSaleAuthorityGrant.requestId, command.requestId))
            .limit(1);
          if (
            existing &&
            existing.artworkId === command.artworkId &&
            existing.ownerPartyId === command.ownerPartyId &&
            existing.authorisedCount === command.authorisedCount
          ) {
            return {
              grantId: existing.id,
              artworkId: existing.artworkId,
              ownerPartyId: existing.ownerPartyId,
              authorisedCount: existing.authorisedCount,
              editionNumbersAuthorised: [],
              editionNumbersRevoked: [],
            };
          }
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Sale authority grant already recorded for this request",
            409,
          );
        }
        throw err;
      }
    },
  };
}
