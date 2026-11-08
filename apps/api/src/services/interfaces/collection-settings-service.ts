import type {
  StaffCollectionChangeResult,
  StaffCollectionSettings,
  StaffCollectionVenue,
} from "@auction/types";
import type {
  AddCollectionExceptionBody,
  RemoveCollectionExceptionBody,
  SaveCollectionSettingsBody,
} from "@auction/validators";
import type { CollectionSettingsResult } from "../collection-settings/collection-settings.errors.js";

/** The staff member making a change. */
export type CollectionSettingsActor = { userId: string };

/**
 * Staff running a place's collection hours, rules and closures. Reads are open to anyone who may
 * see the Collections page; every change is for the Fulfilment role, needs a recent sign-in, and
 * is written to the audit log. A change never cancels a booking by itself: when it leaves bookings
 * outside what the place offers, it is refused with the list until staff choose what to do.
 */
export interface ICollectionSettingsAdminService {
  venues(): Promise<StaffCollectionVenue[]>;
  get(venueId: string): Promise<CollectionSettingsResult<StaffCollectionSettings>>;
  save(
    actor: CollectionSettingsActor,
    venueId: string,
    body: SaveCollectionSettingsBody,
  ): Promise<CollectionSettingsResult<StaffCollectionChangeResult>>;
  addException(
    actor: CollectionSettingsActor,
    venueId: string,
    body: AddCollectionExceptionBody,
  ): Promise<CollectionSettingsResult<StaffCollectionChangeResult>>;
  removeException(
    actor: CollectionSettingsActor,
    venueId: string,
    exceptionId: string,
    body: RemoveCollectionExceptionBody,
  ): Promise<CollectionSettingsResult<StaffCollectionChangeResult>>;
}
