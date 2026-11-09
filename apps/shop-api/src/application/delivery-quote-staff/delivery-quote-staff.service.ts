import { deliveryQuoteDecline, deliveryQuoteTransition } from "@auction/domain";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  DELIVERY_QUOTES_WRITE_CAPABILITY,
  declineNoteIssue,
  deliveryQuoteInputIssues,
  quoteHoldUntil,
} from "@auction/shop-domain";
import { DeliveryQuoteStaffRejectedError } from "../../errors/delivery-quote-staff-rejected-error.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  DeliveryQuoteForUpdate,
  DeliveryQuoteOrderReleaser,
  DeliveryQuoteStaffReader,
  DeliveryQuoteStaffRow,
  DeliveryQuoteStaffUnitOfWork,
  DeliveryQuoteView,
} from "./delivery-quote-staff.ports.js";

export type SendQuoteCommand = {
  quoteId: string;
  pricePence: number;
  carrier: string;
  service?: string | undefined;
  leadTimeNote?: string | undefined;
  actorSubjectId: string;
  idempotencyKey: string;
};

export type DeclineQuoteCommand = {
  quoteId: string;
  note: string;
  actorSubjectId: string;
  idempotencyKey: string;
};

const blankToNull = (value: string | undefined) => value?.trim() || null;

const conflict = (message: string) => new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, message, 409);

/**
 * What the gallery does with a delivery quote request. Staff send a price and carrier (the buyer
 * pays it with insurance included), or say the gallery cannot deliver there. Both are steps of
 * the shared quote machine, checked and audited, replayed for a repeated key, and emailed to the
 * buyer in the same transaction. Sending a quote runs the hold on for three working days, so the
 * buyer has time to pay; turning a request down releases the prints and returns the basket.
 */
export function createDeliveryQuoteStaffService(deps: {
  uow: DeliveryQuoteStaffUnitOfWork;
  reader: DeliveryQuoteStaffReader;
  orders: DeliveryQuoteOrderReleaser;
  clock: { now(): Date };
}) {
  async function lockOpen(
    tx: Parameters<Parameters<DeliveryQuoteStaffUnitOfWork["run"]>[0]>[0],
    quoteId: string,
  ): Promise<DeliveryQuoteForUpdate> {
    const locked = await tx.store.lock(quoteId);
    if (!locked) throw new ShopApiError(SHOP_API_ERROR_CODES.NOT_FOUND, "Quote not found", 404);
    if (locked.orderStatus !== "pending_payment") {
      throw conflict("This order is no longer waiting, so it cannot be quoted");
    }
    return locked;
  }

  return {
    async list(view: DeliveryQuoteView): Promise<{
      items: DeliveryQuoteStaffRow[];
      waitingCount: number;
    }> {
      const [items, waitingCount] = await Promise.all([
        deps.reader.list(view),
        deps.reader.waitingCount(),
      ]);
      return { items, waitingCount };
    },

    sendQuote(command: SendQuoteCommand): Promise<void> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "delivery_quote.send",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: {
            quoteId: command.quoteId,
            pricePence: command.pricePence,
            carrier: command.carrier,
            service: command.service ?? null,
            leadTimeNote: command.leadTimeNote ?? null,
          },
          run: async () => {
            const issues = deliveryQuoteInputIssues(command);
            if (issues.length > 0) throw new DeliveryQuoteStaffRejectedError(issues);
            const locked = await lockOpen(tx, command.quoteId);
            const step = deliveryQuoteTransition(locked.row.status, "quote", "staff");
            if (!step.allowed) throw conflict("This request can no longer be quoted");
            const now = deps.clock.now();
            const holdUntil = quoteHoldUntil(now);
            const carrier = command.carrier.trim();
            const service = blankToNull(command.service);
            const leadTimeNote = blankToNull(command.leadTimeNote);
            await tx.store.saveQuote({
              quoteId: command.quoteId,
              orderId: locked.row.orderId,
              pricePence: command.pricePence,
              carrier,
              service,
              leadTimeNote,
              actorSubjectId: command.actorSubjectId,
              at: now,
              holdUntil,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: DELIVERY_QUOTES_WRITE_CAPABILITY,
              action: "delivery_quote.send",
              targetType: "shop_delivery_quote",
              targetId: command.quoteId,
              beforeJson: {
                status: locked.row.status,
                pricePence: locked.row.quote?.pricePence ?? null,
              },
              afterJson: {
                status: step.next,
                pricePence: command.pricePence,
                carrier,
                orderReference: locked.row.orderReference,
              },
            });
            await tx.mail.quoteReady({
              quote: locked,
              pricePence: command.pricePence,
              carrier,
              service,
              leadTimeNote,
              holdUntil,
            });
          },
        }),
      );
    },

    async decline(command: DeclineQuoteCommand): Promise<void> {
      const orderId = await deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "delivery_quote.decline",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { quoteId: command.quoteId, note: command.note },
          run: async () => {
            const problem = declineNoteIssue(command.note);
            if (problem)
              throw new DeliveryQuoteStaffRejectedError([{ field: "note", reason: problem }]);
            const locked = await lockOpen(tx, command.quoteId);
            const step = deliveryQuoteDecline(locked.row.status);
            if (!step.allowed) throw conflict("This request can no longer be turned down");
            const note = command.note.trim();
            await tx.store.decline({ quoteId: command.quoteId, note, at: deps.clock.now() });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: DELIVERY_QUOTES_WRITE_CAPABILITY,
              action: "delivery_quote.decline",
              targetType: "shop_delivery_quote",
              targetId: command.quoteId,
              beforeJson: { status: locked.row.status },
              afterJson: {
                status: step.next,
                endReason: "cannot_deliver",
                orderReference: locked.row.orderReference,
              },
            });
            await tx.mail.quoteDeclined({ quote: locked, note });
            return locked.row.orderId;
          },
        }),
      );
      // The prints are released and the basket returned once the decision is saved. If this step
      // fails, the order simply runs out its hold and the usual reaper does the same.
      await deps.orders.release(orderId, command.quoteId);
    },
  };
}

export type DeliveryQuoteStaffService = ReturnType<typeof createDeliveryQuoteStaffService>;
