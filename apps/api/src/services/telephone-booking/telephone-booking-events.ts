import type { Database } from "@auction/db";
import type { TelephoneBidBooking } from "@auction/types";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ITelephoneBookingNotifier } from "../interfaces/telephone-booking-notifier.js";

export type TelephoneBookingEventsDeps = {
  db: Database;
  domainEventPublisher: DomainEventPublisher | null;
  notifier: ITelephoneBookingNotifier | null;
};

export function notifyBestEffort(
  deps: TelephoneBookingEventsDeps,
  _label: string,
  fn: (notifier: ITelephoneBookingNotifier) => Promise<void>,
): void {
  const notifier = deps.notifier;
  if (!notifier) return;
  void fn(notifier).catch(() => undefined);
}

export async function publishTelephoneBookingEvent(
  deps: TelephoneBookingEventsDeps,
  eventType: string,
  booking: TelephoneBidBooking,
  extra?: object,
): Promise<void> {
  if (!deps.domainEventPublisher) return;
  await deps.domainEventPublisher.publish(deps.db, {
    eventType,
    aggregateType: "telephone_bid_booking",
    aggregateId: booking.id,
    payload: {
      saleId: booking.saleId,
      userId: booking.userId,
      status: booking.status,
      ...extra,
    },
  });
}
