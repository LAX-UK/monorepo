import type { DeskBookingView, DeskClientLot, DeskDayView, DeskListView } from "@auction/types";
import type {
  CollectionDeskBookForClientBody,
  CollectionDeskHandOverBody,
  CollectionDeskRebookBody,
} from "@auction/validators";
import type { CollectionDeskResult } from "../collection-desk/collection-desk.errors.js";

/** The member of staff acting at the desk. */
export type DeskStaff = { userId: string };

/** The desk for collections: a day of visits, hand-over, missed visits, and booking for a client. */
export interface ICollectionDeskService {
  day(venueId: string, date: string): Promise<CollectionDeskResult<DeskDayView>>;
  list(
    venueId: string,
    status: "upcoming" | "not_collected",
  ): Promise<CollectionDeskResult<DeskListView>>;
  /** A client's works collected from this place, for booking a visit on their behalf. */
  clientLots(
    venueId: string,
    legalEntityId: string,
  ): Promise<CollectionDeskResult<DeskClientLot[]>>;
  handOver(
    staff: DeskStaff,
    bookingId: string,
    body: CollectionDeskHandOverBody,
  ): Promise<CollectionDeskResult<DeskBookingView>>;
  undoHandOver(staff: DeskStaff, bookingId: string): Promise<CollectionDeskResult<DeskBookingView>>;
  markNotCollected(
    staff: DeskStaff,
    bookingId: string,
  ): Promise<CollectionDeskResult<DeskBookingView>>;
  /**
   * Moves a live visit, or books a new time after a missed one. Staff may go over capacity or
   * inside the notice period with a reason, which is recorded with their name.
   */
  rebook(
    staff: DeskStaff,
    bookingId: string,
    body: CollectionDeskRebookBody,
  ): Promise<CollectionDeskResult<DeskBookingView>>;
  bookForClient(
    staff: DeskStaff,
    body: CollectionDeskBookForClientBody,
  ): Promise<CollectionDeskResult<{ booking: DeskBookingView; replayed: boolean }>>;
}
