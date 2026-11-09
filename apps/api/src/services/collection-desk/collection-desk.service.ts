import type { DeskBookingView, DeskClientLot, DeskDayView, DeskListView } from "@auction/types";
import type {
  CollectionDeskBookForClientBody,
  CollectionDeskHandOverBody,
  CollectionDeskRebookBody,
} from "@auction/validators";
import type { DeskStaff, ICollectionDeskService } from "../interfaces/collection-desk-service.js";
import { CollectionDeskCommands } from "./collection-desk.commands.js";
import type { CollectionDeskResult } from "./collection-desk.errors.js";
import { CollectionDeskReads } from "./collection-desk.reads.js";
import { type CollectionDeskDeps, DeskSupport } from "./collection-desk.shared.js";

export type { CollectionDeskDeps } from "./collection-desk.shared.js";

/**
 * The desk for collections. What it shows (`CollectionDeskReads`) and what staff do
 * (`CollectionDeskCommands`) live apart and share only the place's facts and how a booking is
 * drawn (`DeskSupport`); this is the one interface the routes use.
 */
export class CollectionDeskService implements ICollectionDeskService {
  private readonly reads: CollectionDeskReads;
  private readonly commands: CollectionDeskCommands;

  constructor(deps: CollectionDeskDeps) {
    const support = new DeskSupport(deps);
    this.reads = new CollectionDeskReads(support);
    this.commands = new CollectionDeskCommands(support);
  }

  day(venueId: string, date: string): Promise<CollectionDeskResult<DeskDayView>> {
    return this.reads.day(venueId, date);
  }

  list(
    venueId: string,
    status: "upcoming" | "not_collected",
  ): Promise<CollectionDeskResult<DeskListView>> {
    return this.reads.list(venueId, status);
  }

  clientLots(
    venueId: string,
    legalEntityId: string,
  ): Promise<CollectionDeskResult<DeskClientLot[]>> {
    return this.reads.clientLots(venueId, legalEntityId);
  }

  handOver(
    staff: DeskStaff,
    bookingId: string,
    body: CollectionDeskHandOverBody,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    return this.commands.handOver(staff, bookingId, body);
  }

  undoHandOver(
    staff: DeskStaff,
    bookingId: string,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    return this.commands.undoHandOver(staff, bookingId);
  }

  markNotCollected(
    staff: DeskStaff,
    bookingId: string,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    return this.commands.markNotCollected(staff, bookingId);
  }

  rebook(
    staff: DeskStaff,
    bookingId: string,
    body: CollectionDeskRebookBody,
  ): Promise<CollectionDeskResult<DeskBookingView>> {
    return this.commands.rebook(staff, bookingId, body);
  }

  bookForClient(
    staff: DeskStaff,
    body: CollectionDeskBookForClientBody,
  ): Promise<CollectionDeskResult<{ booking: DeskBookingView; replayed: boolean }>> {
    return this.commands.bookForClient(staff, body);
  }
}
