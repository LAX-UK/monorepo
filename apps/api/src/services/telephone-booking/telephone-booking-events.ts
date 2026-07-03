import type { TelephoneBidBooking } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ITelephoneBookingNotifier } from "../interfaces/telephone-booking-notifier.js";

export type TelephoneBookingEventsDeps = {
  domainEventSink: IDomainEventSink | null;
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
  if (!deps.domainEventSink) return;
  await deps.domainEventSink.publish({
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
