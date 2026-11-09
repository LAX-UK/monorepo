import type { CollectionDay } from "@auction/domain";
import type { CollectionBookingRecord } from "@auction/persistence/interfaces";
import type { CollectionDayView, CollectionVisitAction, CollectionVisitView } from "@auction/types";

/** What the person sees of a visit; the lot titles are looked up by the caller. */
export type VisitViewContext = {
  actorUserId: string;
  titles: ReadonlyMap<string, { title: string; lotNumber: number | null }>;
  /** The last moment to change or cancel online, or `null` when it is over or not known. */
  noticeDeadline: Date | null;
  actions: readonly CollectionVisitAction[];
};

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/**
 * A visit as the booker reads it. Another member who booked is only "not you"; nothing that names
 * them, and nothing staff recorded (the override reason, who handed over, the ID type) is sent.
 */
export function toVisitView(
  booking: CollectionBookingRecord,
  context: VisitViewContext,
): CollectionVisitView {
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    start: booking.slotStart.toISOString(),
    end: booking.slotEnd.toISOString(),
    version: booking.icsSequence,
    lots: booking.lots.map((lot) => ({
      lotId: lot.lotId,
      title: context.titles.get(lot.lotId)?.title ?? "Lot",
      lotNumber: context.titles.get(lot.lotId)?.lotNumber ?? null,
      active: lot.active,
      outcome: lot.outcome,
    })),
    collector: {
      kind: booking.collector.kind,
      name: booking.collector.name,
      email: booking.collector.email,
      company: booking.collector.company,
    },
    authorisedAt: iso(booking.authorisedAt),
    bookedByYou: booking.bookedByUserId === context.actorUserId,
    bookedVia: booking.bookedVia,
    noticeDeadline: iso(context.noticeDeadline),
    actions: [...context.actions],
    handedOverAt: iso(booking.outcomeAt),
    cancelledAt: iso(booking.cancelledAt),
  };
}

export function toDayView(day: CollectionDay): CollectionDayView {
  return {
    date: day.date,
    state: day.state,
    openSlots: day.openSlots,
    slots: day.slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      placesLeft: slot.placesLeft,
      state: slot.state,
    })),
  };
}
