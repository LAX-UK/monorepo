import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffMemberReader } from "../../../application/ports/staff-member.reader.js";
import type {
  CreateStockHoldCommand,
  CreateStockHoldResult,
} from "../../../application/ports/stock-hold.writer.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import type { AdminIdempotency } from "../../idempotent-admin-command.js";

export type CreateStockHoldHandlerCommand = {
  editionId: string;
  clientPartyId: string;
  expiresAt: string;
  note?: string;
  actorSubjectId: string;
  /** Holds `stock_hold.override`: may hold for clients not assigned to them. */
  actorMayOverride: boolean;
  idempotencyKey: string;
};

export function createCreateStockHoldHandler(deps: {
  createHold: (
    command: CreateStockHoldCommand,
    ctx: AdminIdempotency,
  ) => Promise<CreateStockHoldResult>;
  staffReader: ShopStaffMemberReader;
}) {
  return async (command: CreateStockHoldHandlerCommand) => {
    const assigned = await deps.staffReader.brokerCanAccessClientParty(
      command.actorSubjectId,
      command.clientPartyId,
    );
    if (!assigned && !command.actorMayOverride) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.STAFF_FORBIDDEN,
        "Not assigned to this client; stock_hold.override required",
        403,
      );
    }
    return deps.createHold(
      {
        editionId: command.editionId,
        clientPartyId: command.clientPartyId,
        expiresAt: command.expiresAt,
        actorSubjectId: command.actorSubjectId,
        actorMayOverride: command.actorMayOverride,
        usedOverride: command.actorMayOverride && !assigned,
        ...(command.note !== undefined ? { note: command.note } : {}),
      },
      { idempotencyKey: command.idempotencyKey, actorSubjectId: command.actorSubjectId },
    );
  };
}
