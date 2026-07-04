import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence";
import type { ILotFulfilmentPaymentHook } from "@auction/persistence";
import type { IPaymentWriteRepository } from "@auction/persistence";
import type { ILotRepository } from "@auction/persistence";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { NotificationFactory } from "../notification.factory.js";

type PaymentRow = NonNullable<Awaited<ReturnType<IPaymentWriteRepository["findById"]>>>;

export async function dispatchPaymentReceived(deps: {
  payment: PaymentRow;
  lots: ILotRepository;
  lotFulfilmentHooks: ILotFulfilmentPaymentHook | null;
  notificationDispatcher: NotificationDispatcher | null;
  notificationFactory: NotificationFactory;
  legalEntityNotificationRecipients: ILegalEntityNotificationRecipientReader | null;
}): Promise<void> {
  const { payment: p } = deps;
  await deps.lotFulfilmentHooks?.onPaymentCaptured(p.lotId, p.id);
  const lot = await deps.lots.findById(p.lotId);
  if (!lot || !deps.notificationDispatcher) return;

  const paidByUserId = p.paidByUserId ?? p.buyerId;
  if (!paidByUserId) return;

  await deps.notificationDispatcher.dispatch(
    paidByUserId,
    notificationRowToPayload(deps.notificationFactory.createPaymentReceived(lot, paidByUserId)),
  );

  const financeRecipients = await resolveLegalEntityNotificationRecipients(
    deps.legalEntityNotificationRecipients,
    {
      legalEntityId: lot.sellerLegalEntityId,
      fallbackUserId: paidByUserId,
      audience: "finance",
    },
  );
  for (const recipientId of financeRecipients) {
    await deps.notificationDispatcher.dispatch(
      recipientId,
      notificationRowToPayload(
        deps.notificationFactory.createSellerPaymentReceived(lot, recipientId, p.amount),
      ),
    );
  }
}
