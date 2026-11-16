import { latestStorageTermsStart, londonDateKey } from "@auction/domain";
import type {
  ICollectionSettingsReader,
  ICollectionStorageRepository,
  StorageAuditRecord,
  StorageChange,
  StorageTermsRecord,
} from "@auction/persistence/interfaces";
import type {
  StaffStorageCharging,
  StaffStorageHistoryAction,
  StaffStorageHistoryEntry,
  StaffStorageSettings,
  StaffStorageTerms,
} from "@auction/types";
import type {
  CancelStorageTermsBody,
  SetStorageChargingBody,
  StorageTermsBody,
} from "@auction/validators";
import { err, ok } from "neverthrow";
import type {
  CollectionStorageActor,
  ICollectionStorageAdminService,
} from "../interfaces/collection-storage-service.js";
import {
  type CollectionStorageErrorCode,
  type CollectionStorageResult,
  storageError,
} from "./collection-storage.errors.js";

/** How many changes the History table shows. */
export const STORAGE_HISTORY_LIMIT = 50;

/** Changes to the place as a whole. Per-lot decisions belong to the lot, not this table. */
const PLACE_ACTIONS: ReadonlySet<StaffStorageHistoryAction> = new Set([
  "terms_scheduled",
  "terms_edited",
  "terms_cancelled",
  "charging_switched",
  "vat_treatment_set",
  "terms_migrated",
]);

const OFF: StaffStorageCharging = { raiseInvoices: false, vatTreatment: null };

export type CollectionStorageDeps = {
  storage: Pick<
    ICollectionStorageRepository,
    | "listTerms"
    | "findTerms"
    | "scheduleTerms"
    | "editScheduledTerms"
    | "cancelScheduledTerms"
    | "findCharging"
    | "setRaiseInvoices"
    | "listPlaceAudit"
  >;
  /** The places staff can set up, to tell an unknown place from one with no terms yet. */
  places: Pick<ICollectionSettingsReader, "venues">;
  now: () => Date;
};

export function toTermsView(record: StorageTermsRecord): StaffStorageTerms {
  return {
    id: record.id,
    effectiveFrom: record.effectiveFrom,
    freeDays: record.freeDays,
    countMode: record.countMode,
    standardDailyPence: record.standardDailyPence,
    largeDailyPence: record.largeDailyPence,
    handlingFeePence: record.handlingFeePence,
    reason: record.reason,
  };
}

const isPlaceAction = (action: string): action is StaffStorageHistoryAction =>
  PLACE_ACTIONS.has(action as StaffStorageHistoryAction);

export function toHistoryView(records: readonly StorageAuditRecord[]): StaffStorageHistoryEntry[] {
  const entries: StaffStorageHistoryEntry[] = [];
  for (const record of records) {
    if (record.lotId !== null || !isPlaceAction(record.action)) continue;
    entries.push({
      id: record.id,
      at: record.createdAt.toISOString(),
      action: record.action,
      who: record.actorName,
      before: record.before,
      after: record.after,
      reason: record.reason,
    });
  }
  return entries.slice(0, STORAGE_HISTORY_LIMIT);
}

/** The terms in force on `today` and the next change, from the live versions (earliest first). */
export function splitTerms(
  versions: readonly StorageTermsRecord[],
  today: string,
): { inForce: StorageTermsRecord | null; scheduled: StorageTermsRecord | null } {
  const started = versions.filter((v) => v.cancelledAt === null && v.effectiveFrom <= today);
  const waiting = versions.filter((v) => v.cancelledAt === null && v.effectiveFrom > today);
  return { inForce: started.at(-1) ?? null, scheduled: waiting[0] ?? null };
}

const refuse = (code: CollectionStorageErrorCode) => err(storageError(code));

/** Why a start date cannot be used on `today`, or null: from tomorrow, within two years. */
function startProblem(effectiveFrom: string, today: string): CollectionStorageErrorCode | null {
  if (effectiveFrom <= today) return "start_not_in_future";
  if (effectiveFrom > latestStorageTermsStart(today)) return "start_too_late";
  return null;
}

/**
 * The Storage tab's reads and changes. The repository writes each change and its audit row in one
 * transaction (who, when, before, after, why); this decides what may change and answers with the
 * tab as it then stands.
 */
export class CollectionStorageAdminService implements ICollectionStorageAdminService {
  constructor(private readonly deps: CollectionStorageDeps) {}

  private today(): string {
    return londonDateKey(this.deps.now());
  }

  private change(actor: CollectionStorageActor): StorageChange {
    return { actorUserId: actor.userId, at: this.deps.now() };
  }

  private async placeExists(venueId: string): Promise<boolean> {
    const venues = await this.deps.places.venues();
    return venues.some((venue) => venue.venueId === venueId);
  }

  async get(venueId: string): Promise<CollectionStorageResult<StaffStorageSettings>> {
    if (!(await this.placeExists(venueId))) return refuse("venue_not_found");
    return ok(await this.read(venueId));
  }

  private async read(venueId: string): Promise<StaffStorageSettings> {
    const today = this.today();
    const [versions, charging, audit] = await Promise.all([
      this.deps.storage.listTerms(venueId),
      this.deps.storage.findCharging(venueId),
      this.deps.storage.listPlaceAudit(venueId, STORAGE_HISTORY_LIMIT),
    ]);
    const { inForce, scheduled } = splitTerms(versions, today);
    return {
      venueId,
      today,
      inForce: inForce ? toTermsView(inForce) : null,
      scheduled: scheduled ? toTermsView(scheduled) : null,
      charging: charging ?? OFF,
      history: toHistoryView(audit),
    };
  }

  async schedule(
    actor: CollectionStorageActor,
    venueId: string,
    body: StorageTermsBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>> {
    if (!(await this.placeExists(venueId))) return refuse("venue_not_found");
    const today = this.today();
    const problem = startProblem(body.effectiveFrom, today);
    if (problem) return refuse(problem);
    // The repository refuses a second waiting change under the place lock.
    const outcome = await this.deps.storage.scheduleTerms(venueId, body, today, this.change(actor));
    if (outcome.outcome !== "scheduled") return refuse(outcome.outcome);
    return ok(await this.read(venueId));
  }

  /** The version, when it belongs to the place and has not started on `today`. */
  private async scheduledVersion(
    venueId: string,
    termsId: string,
    today: string,
  ): Promise<CollectionStorageResult<StorageTermsRecord>> {
    const version = await this.deps.storage.findTerms(termsId);
    if (!version || version.venueId !== venueId) return refuse("terms_not_found");
    if (version.cancelledAt !== null || version.effectiveFrom <= today) {
      return refuse("not_scheduled");
    }
    return ok(version);
  }

  async edit(
    actor: CollectionStorageActor,
    venueId: string,
    termsId: string,
    body: StorageTermsBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>> {
    const today = this.today();
    const found = await this.scheduledVersion(venueId, termsId, today);
    if (found.isErr()) return err(found.error);
    const problem = startProblem(body.effectiveFrom, today);
    if (problem) return refuse(problem);
    const outcome = await this.deps.storage.editScheduledTerms(
      termsId,
      body,
      today,
      this.change(actor),
    );
    if (outcome.outcome === "not_found") return refuse("terms_not_found");
    if (outcome.outcome !== "saved") return refuse(outcome.outcome);
    return ok(await this.read(venueId));
  }

  async cancel(
    actor: CollectionStorageActor,
    venueId: string,
    termsId: string,
    body: CancelStorageTermsBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>> {
    const today = this.today();
    const found = await this.scheduledVersion(venueId, termsId, today);
    if (found.isErr()) return err(found.error);
    const outcome = await this.deps.storage.cancelScheduledTerms(
      termsId,
      today,
      body.reason,
      this.change(actor),
    );
    if (outcome.outcome === "not_found") return refuse("terms_not_found");
    if (outcome.outcome !== "saved") return refuse(outcome.outcome);
    return ok(await this.read(venueId));
  }

  async setCharging(
    actor: CollectionStorageActor,
    venueId: string,
    body: SetStorageChargingBody,
  ): Promise<CollectionStorageResult<StaffStorageSettings>> {
    if (!(await this.placeExists(venueId))) return refuse("venue_not_found");
    const outcome = await this.deps.storage.setRaiseInvoices(
      venueId,
      body.raiseInvoices,
      body.reason,
      this.change(actor),
    );
    if (outcome.outcome !== "saved") return refuse(outcome.outcome);
    return ok(await this.read(venueId));
  }
}
