import type { DeskBookingView, DeskDayView, DeskListView, DeskLotView } from "@auction/types";

export const DESK_VENUE = "d0000000-0000-4000-8000-0000000000aa";
export const DESK_BOOKING = "d0000000-0000-4000-8000-0000000000b1";
export const DESK_LOT_A = "d0000000-0000-4000-8000-0000000000c1";
export const DESK_LOT_B = "d0000000-0000-4000-8000-0000000000c2";
export const DESK_LOT_C = "d0000000-0000-4000-8000-0000000000c3";

export function deskLot(over: Partial<DeskLotView> = {}): DeskLotView {
  return {
    lotId: DESK_LOT_A,
    title: "Coastal Notation",
    lotNumber: 4,
    image: null,
    released: true,
    fulfilmentStatus: "released",
    active: true,
    outcome: null,
    ...over,
  };
}

export function deskBooking(over: Partial<DeskBookingView> = {}): DeskBookingView {
  return {
    id: DESK_BOOKING,
    reference: "COL-1042",
    status: "booked",
    start: "2026-11-12T14:00:00.000Z",
    end: "2026-11-12T14:30:00.000Z",
    version: 0,
    buyer: { id: "e1", name: "Hayes Collection" },
    bookedVia: "client",
    overCapacity: false,
    collector: { kind: "self", name: "Charlotte Hayes", company: null },
    lots: [deskLot(), deskLot({ lotId: DESK_LOT_B, title: "Lowland Storm", lotNumber: 9 })],
    idCheckType: null,
    handedOverAt: null,
    undoUntil: null,
    // A visit still to come: the API offers "not collected" only once the visit has started.
    actions: ["hand_over", "rebook"],
    handOverBlocked: null,
    ...over,
  };
}

export function deskDay(over: Partial<DeskDayView> = {}): DeskDayView {
  return {
    venueId: DESK_VENUE,
    date: "2026-11-12",
    state: "open",
    canOpenAnyway: false,
    capacity: 2,
    visitMinutes: 30,
    openTimes: 16,
    groups: [
      {
        start: "2026-11-12T14:00:00.000Z",
        end: "2026-11-12T14:30:00.000Z",
        taken: 2,
        capacity: 2,
        bookings: [
          deskBooking(),
          deskBooking({
            id: "d0000000-0000-4000-8000-0000000000b2",
            reference: "COL-1043",
            buyer: { id: "e2", name: "Okafor Trust" },
            collector: { kind: "third_party", name: "Sam Shipper", company: "Fast Freight Ltd" },
            lots: [
              deskLot({
                lotId: DESK_LOT_C,
                title: "Harbour at First Light",
                lotNumber: 2,
                released: false,
                fulfilmentStatus: "awaiting_release",
              }),
            ],
            handOverBlocked: "not_released",
          }),
        ],
      },
    ],
    toHandOver: 2,
    notCollected: 1,
    ...over,
  };
}

/** The visits to come, or the missed ones, as the list tabs show them. */
export function deskList(
  status: DeskListView["status"] = "upcoming",
  over: Partial<DeskListView> = {},
): DeskListView {
  const items =
    status === "not_collected"
      ? [
          // A visit that has already passed (the fixtures' today is 9 Nov).
          deskBooking({
            status: "not_collected",
            actions: ["rebook"],
            start: "2026-11-05T14:00:00.000Z",
            end: "2026-11-05T14:30:00.000Z",
          }),
        ]
      : [deskBooking()];
  return {
    venueId: DESK_VENUE,
    status,
    items,
    more: false,
    notCollected: status === "not_collected" ? items.length : 0,
    ...over,
  };
}
