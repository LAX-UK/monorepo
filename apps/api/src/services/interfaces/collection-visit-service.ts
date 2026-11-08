import type { CollectionAvailability, CollectionVisitView } from "@auction/types";
import type {
  BookCollectionBody,
  CancelCollectionBody,
  ChangeCollectionBody,
} from "@auction/validators";
import type { CollectionVisitResult } from "../collection-visits/collection-visit.errors.js";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

export type BookedVisit = {
  visit: CollectionVisitView;
  /** True when the same attempt was sent before: this is that booking, unchanged. */
  replayed: boolean;
};

export type CalendarFile = { filename: string; content: string };

/**
 * A buyer's collection visits: finding times, booking, changing, cancelling and reading them.
 * Every method acts for one account, as one member of it. Writes are refused to a platform admin
 * viewing as the account; reads are not.
 */
export interface ICollectionVisitService {
  /** The days and times open for the lots, and which lots can be ticked. */
  availability(
    actor: OrganisationMemberActor,
    query: { lots: readonly string[]; booking?: string | undefined },
  ): Promise<CollectionVisitResult<CollectionAvailability>>;
  /** The account's visits the member may see, newest first. */
  list(actor: OrganisationMemberActor): Promise<CollectionVisitResult<CollectionVisitView[]>>;
  book(
    actor: OrganisationMemberActor,
    body: BookCollectionBody,
  ): Promise<CollectionVisitResult<BookedVisit>>;
  change(
    actor: OrganisationMemberActor,
    bookingId: string,
    body: ChangeCollectionBody,
  ): Promise<CollectionVisitResult<CollectionVisitView>>;
  cancel(
    actor: OrganisationMemberActor,
    bookingId: string,
    body: CancelCollectionBody,
  ): Promise<CollectionVisitResult<CollectionVisitView>>;
  /** The calendar file for a live visit, for "Add to calendar". */
  calendar(
    actor: OrganisationMemberActor,
    bookingId: string,
  ): Promise<CollectionVisitResult<CalendarFile>>;
}
