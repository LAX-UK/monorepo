import type { Database } from "@auction/db";
import { shopEdition, shopParty, shopThirdPartySale } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq, inArray } from "drizzle-orm";
import {
  assertEditionAvailableForThirdPartySale,
  assertThirdPartySaleParties,
} from "../../application/admin/sale-rules.js";
import type { ThirdPartySaleWriter } from "../../application/ports/third-party-sale.writer.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../../lib/pg-errors.js";
import { insertShopAdminAudit } from "../shop-admin-audit.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

export function createDrizzleThirdPartySaleWriter(
  db: Database,
  domainEventMode: ShopDomainEventPublisherMode = "off",
): ThirdPartySaleWriter {
  const events = createShopDomainEventPublisher(domainEventMode);

  return {
    async recordSale(command) {
      assertThirdPartySaleParties(command);
      try {
        return await db.transaction(async (tx) => {
          const [edition] = await tx
            .select({ listingStatus: shopEdition.listingStatus })
            .from(shopEdition)
            .where(eq(shopEdition.id, command.editionId))
            .for("update")
            .limit(1);
          if (!edition) {
            throw notFound("Edition");
          }
          assertEditionAvailableForThirdPartySale(edition.listingStatus);
          const parties = await tx
            .select({ id: shopParty.id })
            .from(shopParty)
            .where(inArray(shopParty.id, [command.sellerPartyId, command.buyerPartyId]));
          if (parties.length !== 2) {
            throw notFound("Seller or buyer party");
          }

          const [sale] = await tx
            .insert(shopThirdPartySale)
            .values({
              editionId: command.editionId,
              sellerPartyId: command.sellerPartyId,
              buyerPartyId: command.buyerPartyId,
              grossPence: command.grossPence,
              recordedBySubjectId: command.actorSubjectId,
              status: "draft",
            })
            .returning({ id: shopThirdPartySale.id });
          if (!sale) {
            throw new Error("Failed to record third-party sale");
          }
          await insertShopAdminAudit(tx as Database, {
            actorSubjectId: command.actorSubjectId,
            capability: "third_party_sale.write",
            action: "record_third_party_sale",
            targetType: "shop_third_party_sale",
            targetId: sale.id,
            afterJson: {
              editionId: command.editionId,
              sellerPartyId: command.sellerPartyId,
              buyerPartyId: command.buyerPartyId,
              grossPence: command.grossPence,
            },
          });
          await events.insertInTransaction(tx as Database, {
            aggregateType: "shop_third_party_sale",
            aggregateId: sale.id,
            eventType: "shop.third_party_sale.recorded",
            producer: "shop-api",
            payload: { schemaVersion: 1, saleId: sale.id, editionId: command.editionId },
          });
          return { saleId: sale.id, status: "draft" as const };
        });
      } catch (err) {
        if (isPgUniqueViolation(err)) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Edition already has an open third-party sale",
            409,
          );
        }
        throw err;
      }
    },
  };
}
