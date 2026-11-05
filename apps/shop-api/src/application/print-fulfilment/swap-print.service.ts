import { type AdminSwapPrintResponse, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  ShopDomainError,
  assertSwapAllowed,
  assertSwapReason,
  nextPrintToSend,
} from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import { assertPackable } from "./confirm-print.service.js";
import type { PrintFulfilmentUnitOfWork, StaffCommand } from "./print-fulfilment.ports.js";
import { candidatesOf, expectedPrintOf, isNumberedRun, labelOfPrint } from "./print-identity.js";

const CAPABILITY = "fulfilment.write";
const CROSS_OWNER_CAPABILITY = "print_swap.cross_owner";

export type SwapPrintCommand = StaffCommand & {
  orderLineId: string;
  /** The print to send; left out, the next free print is chosen. */
  toEditionId: string | undefined;
  reason: string;
  /** Holds `print_swap.cross_owner`: may send a print another party owns. */
  canSwapAcrossOwners: boolean;
};

function forbidden(message: string): ShopApiError {
  return new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, message, 403);
}

/**
 * Sends another print in place of the one sold, before it is packed: the print is missing or
 * damaged. The replacement is chosen under a lock (the same owner's lowest free number first), so
 * two swaps never pick one print. A replacement with a different owner moves the seller and the
 * pending payout, which only a shop admin may do. The buyer is emailed when they had been shown
 * a number.
 */
export function createSwapPrintService(deps: { uow: PrintFulfilmentUnitOfWork }) {
  const { uow } = deps;

  return {
    swap(command: SwapPrintCommand): Promise<AdminSwapPrintResponse> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "print.swap",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async (): Promise<AdminSwapPrintResponse> => {
            const reason = assertSwapReason(command.reason);
            const line = await tx.lines.lock(command.orderLineId);
            if (!line) throw notFound("Order line not found");
            assertPackable(line);
            if (line.confirmedAt) {
              throw new ShopDomainError("This print is already packed, so it cannot be replaced");
            }
            const context = await tx.lines.runContext(line.artworkId);
            const expected = expectedPrintOf(line, context.run);
            const runPrints = await tx.swaps.lockRunPrints(line.artworkId, line.print.editionId);
            const candidates = candidatesOf(runPrints, context.run);

            const chosen = command.toEditionId
              ? candidates.find((candidate) => candidate.editionId === command.toEditionId)
              : nextPrintToSend(expected, candidates);
            if (!chosen) {
              throw new ShopDomainError(
                command.toEditionId
                  ? "That print is not part of this run"
                  : "No other print of this run is free to send",
              );
            }
            if (!chosen.freeToSell) {
              throw new ShopDomainError(`${chosen.label} is not free to send`);
            }
            const crossOwner =
              expected.ownerPartyId === null || chosen.ownerPartyId !== expected.ownerPartyId;
            try {
              assertSwapAllowed(
                { outcome: crossOwner ? "swap_needs_admin" : "swap_allowed" },
                { canCrossOwner: command.canSwapAcrossOwners },
              );
            } catch (error) {
              if (error instanceof ShopDomainError) throw forbidden(error.message);
              throw error;
            }

            const to = runPrints.find((print) => print.editionId === chosen.editionId);
            if (!to) throw new ShopDomainError("That print is not part of this run");
            const { payoutMoved } = await tx.swaps.move({
              line,
              to,
              fromLabel: expected.label,
              toLabel: chosen.label,
              reason,
              actorSubjectId: command.actorSubjectId,
            });

            await tx.events.append({
              editionId: line.print.editionId,
              kind: "print_set_aside",
              fromValue: expected.label,
              toValue: reason,
              actorSubjectId: command.actorSubjectId,
              orderId: line.orderId,
            });
            await tx.events.append({
              editionId: chosen.editionId,
              kind: "print_sent_instead",
              fromValue: expected.label,
              toValue: chosen.label,
              actorSubjectId: command.actorSubjectId,
              orderId: line.orderId,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: crossOwner ? CROSS_OWNER_CAPABILITY : CAPABILITY,
              action: "swap_print",
              targetType: "shop_order_line",
              targetId: line.orderLineId,
              beforeJson: { label: expected.label, sellerPartyId: line.sellerPartyId },
              afterJson: {
                label: chosen.label,
                sellerPartyId: chosen.ownerPartyId,
                payoutMoved,
                reason,
              },
            });

            // The number was shown to the buyer only on numbered runs; an unnumbered print
            // changing hands is nothing the buyer was told.
            const buyerNotified = isNumberedRun(context);
            if (buyerNotified) {
              await tx.notifier.printSwapped({
                idempotencyKey: `print-swapped:${line.orderLineId}:${chosen.editionId}`,
                identitySubjectId: line.buyerIdentitySubjectId,
                fallbackEmail: line.buyerFallbackEmail,
                orderReference: line.orderReference,
                artworkTitle: line.artworkTitle,
                newLabel: chosen.label,
                previousLabel: expected.label,
              });
            }
            return {
              label: chosen.label,
              previousLabel: labelOfPrint(line.print, context.run),
              payoutMoved,
              buyerNotified,
            };
          },
        }),
      );
    },
  };
}

export type SwapPrintService = ReturnType<typeof createSwapPrintService>;
