import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type ShopStaffRole, roleHasCapability } from "@auction/shop-domain";
import type { ShopStaffMemberReader } from "../../../application/ports/staff-member.reader.js";
import type { StockHoldWriter } from "../../../application/ports/stock-hold.writer.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";

export type CreateStockHoldHandlerCommand = {
  editionId: string;
  clientPartyId: string;
  expiresAt: string;
  note?: string;
  actorSubjectId: string;
  actorRole: ShopStaffRole;
};

export function createCreateStockHoldHandler(deps: {
  stockHolds: StockHoldWriter;
  staffReader: ShopStaffMemberReader;
}) {
  return async (command: CreateStockHoldHandlerCommand) => {
    const assigned = await deps.staffReader.brokerCanAccessClientParty(
      command.actorSubjectId,
      command.clientPartyId,
    );
    if (command.actorRole === "broker") {
      if (!assigned) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.STAFF_FORBIDDEN,
          "Broker is not assigned to this client",
          403,
        );
      }
    } else if (!assigned && !roleHasCapability(command.actorRole, "stock_hold.override")) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.STAFF_FORBIDDEN,
        "Not assigned to this client; stock_hold.override required",
        403,
      );
    }
    return deps.stockHolds.createHold({
      editionId: command.editionId,
      clientPartyId: command.clientPartyId,
      expiresAt: command.expiresAt,
      actorSubjectId: command.actorSubjectId,
      actorRole: command.actorRole,
      usedOverride: command.actorRole !== "broker" && !assigned,
      ...(command.note !== undefined ? { note: command.note } : {}),
    });
  };
}
