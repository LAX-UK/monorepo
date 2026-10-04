import type { Database } from "@auction/db";
import { shopClientAssignment, shopEdition, shopParty, shopStockHold } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import type { StockHoldWriter } from "../../application/ports/stock-hold.writer.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../../lib/pg-errors.js";
import { insertShopAdminAudit } from "../shop-admin-audit.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";
import { resolveListingStatusAfterReservationRelease } from "../shop-edition-listing-on-release.js";

async function resolveBrokerPartyIdForClient(tx: Database, clientPartyId: string): Promise<string> {
  const [assignment] = await tx
    .select({ brokerSubjectId: shopClientAssignment.brokerSubjectId })
    .from(shopClientAssignment)
    .where(eq(shopClientAssignment.clientPartyId, clientPartyId))
    .limit(1);
  if (assignment) {
    const [brokerParty] = await tx
      .select({ id: shopParty.id })
      .from(shopParty)
      .where(eq(shopParty.identitySubjectId, assignment.brokerSubjectId))
      .limit(1);
    if (brokerParty) {
      return brokerParty.id;
    }
  }
  const [laxParty] = await tx
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.kind, "lax"))
    .limit(1);
  if (!laxParty) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
      "No broker assignment or LAX party for stock hold",
      501,
    );
  }
  return laxParty.id;
}

export function createDrizzleStockHoldWriter(
  db: Database,
  domainEventMode: ShopDomainEventPublisherMode = "off",
): StockHoldWriter {
  const events = createShopDomainEventPublisher(domainEventMode);

  return {
    async createHold(command) {
      const expiresAt = new Date(command.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.VALIDATION,
          "Hold expiry must be in the future",
          400,
        );
      }

      try {
        return await db.transaction(async (tx) => {
          let brokerPartyId: string;
          if (command.actorRole === "broker") {
            const [assignment] = await tx
              .select({ brokerSubjectId: shopClientAssignment.brokerSubjectId })
              .from(shopClientAssignment)
              .where(
                and(
                  eq(shopClientAssignment.clientPartyId, command.clientPartyId),
                  eq(shopClientAssignment.brokerSubjectId, command.actorSubjectId),
                ),
              )
              .limit(1);
            if (!assignment) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.FORBIDDEN,
                "Broker is not assigned to this client",
                403,
              );
            }
            const [brokerParty] = await tx
              .select({ id: shopParty.id })
              .from(shopParty)
              .where(eq(shopParty.identitySubjectId, command.actorSubjectId))
              .limit(1);
            if (!brokerParty) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.POLICY_NOT_CONFIGURED,
                "Broker party not found for acting subject",
                501,
              );
            }
            brokerPartyId = brokerParty.id;
          } else {
            const [clientParty] = await tx
              .select({ id: shopParty.id })
              .from(shopParty)
              .where(eq(shopParty.id, command.clientPartyId))
              .limit(1);
            if (!clientParty) {
              throw notFound("Client party");
            }
            brokerPartyId = await resolveBrokerPartyIdForClient(tx as Database, clientParty.id);
          }

          const [edition] = await tx
            .select({ id: shopEdition.id })
            .from(shopEdition)
            .where(eq(shopEdition.id, command.editionId))
            .for("update")
            .limit(1);
          if (!edition) {
            throw notFound("Edition");
          }

          const updated = await tx
            .update(shopEdition)
            .set({ listingStatus: "held" })
            .where(
              and(
                eq(shopEdition.id, command.editionId),
                eq(shopEdition.listingStatus, "authorised"),
              ),
            )
            .returning({ id: shopEdition.id });
          if (updated.length !== 1) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Edition is not available to hold",
              409,
            );
          }

          const [hold] = await tx
            .insert(shopStockHold)
            .values({
              editionId: command.editionId,
              brokerPartyId,
              clientPartyId: command.clientPartyId,
              expiresAt,
              createdBySubjectId: command.actorSubjectId,
              ...(command.note ? { note: command.note } : {}),
            })
            .returning({ id: shopStockHold.id });
          if (!hold) {
            throw new Error("Failed to create stock hold");
          }
          if (command.usedOverride) {
            await insertShopAdminAudit(tx as Database, {
              actorSubjectId: command.actorSubjectId,
              capability: "stock_hold.override",
              action: "create_hold_override",
              targetType: "shop_stock_hold",
              targetId: hold.id,
              afterJson: {
                editionId: command.editionId,
                clientPartyId: command.clientPartyId,
              },
            });
          }
          await insertShopAdminAudit(tx as Database, {
            actorSubjectId: command.actorSubjectId,
            capability: "stock_hold.write",
            action: "create_hold",
            targetType: "shop_stock_hold",
            targetId: hold.id,
            afterJson: {
              editionId: command.editionId,
              clientPartyId: command.clientPartyId,
              expiresAt: expiresAt.toISOString(),
              brokerPartyId,
            },
          });
          await events.insertInTransaction(tx as Database, {
            aggregateType: "shop_stock_hold",
            aggregateId: hold.id,
            eventType: "shop.stock_hold.created",
            producer: "shop-api",
            payload: {
              schemaVersion: 1,
              holdId: hold.id,
              editionId: command.editionId,
            },
          });
          return { holdId: hold.id, status: "active" as const };
        });
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Edition already has an active hold",
            409,
          );
        }
        throw err;
      }
    },

    async releaseHold(command) {
      const releasedAt = new Date();
      return db.transaction(async (tx) => {
        const [hold] = await tx
          .select({
            id: shopStockHold.id,
            editionId: shopStockHold.editionId,
            status: shopStockHold.status,
            brokerPartyId: shopStockHold.brokerPartyId,
          })
          .from(shopStockHold)
          .where(eq(shopStockHold.id, command.holdId))
          .for("update")
          .limit(1);
        if (!hold) {
          throw notFound("Stock hold");
        }
        if (hold.status !== "active") {
          throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Hold is not active", 409);
        }
        if (command.actorRole === "broker") {
          const [brokerParty] = await tx
            .select({ id: shopParty.id })
            .from(shopParty)
            .where(eq(shopParty.identitySubjectId, command.actorSubjectId))
            .limit(1);
          if (!brokerParty || brokerParty.id !== hold.brokerPartyId) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.FORBIDDEN,
              "Broker can only release their own holds",
              403,
            );
          }
        }
        await tx
          .update(shopStockHold)
          .set({ status: "released", releasedAt })
          .where(eq(shopStockHold.id, command.holdId));
        const [edition] = await tx
          .select({
            artworkId: shopEdition.artworkId,
            ownerPartyId: shopEdition.ownerPartyId,
          })
          .from(shopEdition)
          .where(and(eq(shopEdition.id, hold.editionId), eq(shopEdition.listingStatus, "held")))
          .limit(1);
        if (edition) {
          const listingStatus = await resolveListingStatusAfterReservationRelease(tx, {
            artworkId: edition.artworkId,
            ownerPartyId: edition.ownerPartyId,
          });
          await tx
            .update(shopEdition)
            .set({ listingStatus })
            .where(and(eq(shopEdition.id, hold.editionId), eq(shopEdition.listingStatus, "held")));
        }
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: command.actorSubjectId,
          capability: "stock_hold.write",
          action: "release_hold",
          targetType: "shop_stock_hold",
          targetId: command.holdId,
          afterJson: { editionId: hold.editionId, status: "released" },
        });
        await events.insertInTransaction(tx as Database, {
          aggregateType: "shop_stock_hold",
          aggregateId: command.holdId,
          eventType: "shop.stock_hold.released",
          producer: "shop-api",
          payload: {
            schemaVersion: 1,
            holdId: command.holdId,
            editionId: hold.editionId,
          },
        });
        return { holdId: command.holdId, status: "released" as const };
      });
    },
  };
}
