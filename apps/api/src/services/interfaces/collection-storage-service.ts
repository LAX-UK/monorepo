import type { StaffOverdueLots, StaffStorageSettings } from "@auction/types";
import type {
  CancelStorageTermsBody,
  ExtendLotStorageBody,
  SetStorageChargingBody,
  StorageTermsBody,
  WaiveLotStorageBody,
} from "@auction/validators";
import type { CollectionStorageResult } from "../collection-storage/collection-storage.errors.js";

/** The staff member making a change. */
export type CollectionStorageActor = { userId: string };

/**
 * A collection place's storage terms and its "Raise storage invoices" switch, for Bid admin's
 * Storage tab (docs/design/storage-terms.md). Reads are for everyone who sees the tab; changes are
 * for Finance and Administrators after a recent sign-in. Every change is written with who, when,
 * before, after and why, and answers with the tab as it now stands.
 */
export interface ICollectionStorageAdminService {
  get(venueId: string): Promise<CollectionStorageResult<StaffStorageSettings>>;
  /** Schedules new terms from a day after today. One change waits at a time. */
  schedule(
    actor: CollectionStorageActor,
    venueId: string,
    body: StorageTermsBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>>;
  /** Edits the change that has not started yet. */
  edit(
    actor: CollectionStorageActor,
    venueId: string,
    termsId: string,
    body: StorageTermsBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>>;
  /** Cancels the change that has not started yet; the terms in force stay. */
  cancel(
    actor: CollectionStorageActor,
    venueId: string,
    termsId: string,
    body: CancelStorageTermsBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>>;
  /** Switches "Raise storage invoices"; on needs a VAT treatment. */
  setCharging(
    actor: CollectionStorageActor,
    venueId: string,
    body: SetStorageChargingBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>>;
}

/**
 * Lots left past their collect-by day at a place, for the Not collected tab, and the two per-lot
 * decisions staff take on them: Fulfilment extends free storage, Finance waives the charges. Each
 * answers with the list as it now stands, and is audited with who, when, before, after and why.
 */
export interface ICollectionStorageFollowUpService {
  overdue(venueId: string): Promise<CollectionStorageResult<StaffOverdueLots>>;
  /** Adds free days to one waiting lot; all of a lot's extensions together stop at 30 days. */
  extend(
    actor: CollectionStorageActor,
    venueId: string,
    lotId: string,
    body: ExtendLotStorageBody,
  ): Promise<CollectionStorageResult<StaffOverdueLots>>;
  /** Waives one waiting lot's storage charges. */
  waive(
    actor: CollectionStorageActor,
    venueId: string,
    lotId: string,
    body: WaiveLotStorageBody,
  ): Promise<CollectionStorageResult<StaffOverdueLots>>;
}
