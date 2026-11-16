import {
  type LotStorageCharge,
  MAX_STORAGE_EXTENSION_DAYS,
  formatStorageRunningTotal,
  londonDateKey,
  lotStorageCharge,
  needsStorageFollowUp,
  storageDaysOver,
  storageQuotePauses,
} from "@auction/domain";
import type {
  ICollectionSettingsReader,
  ICollectionStorageRepository,
  StorageChange,
  WaitingLotAtPlace,
} from "@auction/persistence/interfaces";
import type { StaffOverdueLot, StaffOverdueLots } from "@auction/types";
import type { ExtendLotStorageBody, WaiveLotStorageBody } from "@auction/validators";
import { err, ok } from "neverthrow";
import type {
  CollectionStorageActor,
  ICollectionStorageFollowUpService,
} from "../interfaces/collection-storage-service.js";
import {
  type CollectionStorageResult,
  extensionCapError,
  storageError,
} from "./collection-storage.errors.js";

/** The most waiting lots read for one place; the oldest first, so the longest over are in it. */
export const WAITING_LOTS_READ_LIMIT = 1000;

/** The most lots the Not collected tab lists at once, longest over first. */
export const OVERDUE_LOTS_LIMIT = 200;

export type CollectionStorageFollowUpDeps = {
  storage: Pick<
    ICollectionStorageRepository,
    "waitingLotsAt" | "addExtension" | "addWaiver" | "findCharging"
  >;
  /** The places staff can set up, to tell an unknown place from one with nothing waiting. */
  places: Pick<ICollectionSettingsReader, "venues">;
  now: () => Date;
  /** Where a lot that cannot be priced is reported; it is left off the list, not the whole list. */
  log?: (message: string, detail: Record<string, unknown>) => void;
};

type Priced = { lot: WaitingLotAtPlace; priced: LotStorageCharge };

/**
 * The staff follow-up of lots left past their collect-by day (Bid admin › Collections › Not
 * collected; docs/design/storage-terms.md, ST10 and ST15). Each lot is priced by the same domain
 * rules and terms as the buyer's page, so what staff see is what the buyer sees: the amount is
 * counted whether or not the place raises invoices, and while it does not it is only what would be
 * due. Fulfilment extends a lot's free storage (up to 30 days in all) and Finance waives its
 * charges, each with a reason; the audit keeps who, when, the collect-by day and amount before and
 * after, and why. Nothing is sold or disposed of here (ST16).
 */
export class CollectionStorageFollowUpService implements ICollectionStorageFollowUpService {
  constructor(private readonly deps: CollectionStorageFollowUpDeps) {}

  private async placeExists(venueId: string): Promise<boolean> {
    const venues = await this.deps.places.venues();
    return venues.some((v) => v.venueId === venueId);
  }

  /** Every waiting lot at the place, priced on `today`. Lots the rules refuse are left out. */
  private async priced(venueId: string, today: string): Promise<{ lots: Priced[]; more: boolean }> {
    const { lots, more } = await this.deps.storage.waitingLotsAt(venueId, WAITING_LOTS_READ_LIMIT);
    const priced: Priced[] = [];
    for (const lot of lots) {
      const { calendar } = lot.storage;
      if (!calendar) continue;
      try {
        priced.push({
          lot,
          priced: lotStorageCharge({
            facts: lot.storage.pricing,
            clearedAt: lot.clearedAt,
            pausedRanges: storageQuotePauses(lot.storage.quote, today),
            calendar,
            asOf: today,
          }),
        });
      } catch (cause) {
        this.deps.log?.("collection_storage_lot_unpriced", { venueId, lotId: lot.lotId, cause });
      }
    }
    return { lots: priced, more };
  }

  async overdue(venueId: string): Promise<CollectionStorageResult<StaffOverdueLots>> {
    if (!(await this.placeExists(venueId))) return err(storageError("venue_not_found"));
    return ok(await this.view(venueId));
  }

  private async view(venueId: string): Promise<StaffOverdueLots> {
    const today = londonDateKey(this.deps.now());
    const { lots, more } = await this.priced(venueId, today);
    const over = lots
      .filter(({ priced }) => today > priced.charge.collectBy)
      .map((entry) => toOverdueLot(entry, today))
      .sort((a, b) => b.daysOver - a.daysOver || a.lotId.localeCompare(b.lotId));
    return {
      venueId,
      today,
      chargingOn: lots[0]?.lot.storage.chargingOn ?? (await this.chargingOn(venueId)),
      lots: over.slice(0, OVERDUE_LOTS_LIMIT),
      more: more || over.length > OVERDUE_LOTS_LIMIT,
    };
  }

  /** The switch, for a place with nothing waiting (it is read with each lot otherwise). */
  private async chargingOn(venueId: string): Promise<boolean> {
    return (await this.deps.storage.findCharging(venueId))?.raiseInvoices ?? false;
  }

  /** The waiting lot at the place, priced today, or `null` when it is not waiting there. */
  private async find(venueId: string, lotId: string): Promise<Priced | null> {
    const today = londonDateKey(this.deps.now());
    const { lots } = await this.priced(venueId, today);
    return lots.find((entry) => entry.lot.lotId === lotId) ?? null;
  }

  private change(actor: CollectionStorageActor): StorageChange {
    return { actorUserId: actor.userId, at: this.deps.now() };
  }

  async extend(
    actor: CollectionStorageActor,
    venueId: string,
    lotId: string,
    body: ExtendLotStorageBody,
  ): Promise<CollectionStorageResult<StaffOverdueLots>> {
    if (!(await this.placeExists(venueId))) return err(storageError("venue_not_found"));
    const found = await this.find(venueId, lotId);
    if (!found) return err(storageError("lot_not_found"));
    const { lot, priced } = found;
    const left = MAX_STORAGE_EXTENSION_DAYS - lot.storage.pricing.extensionDays;
    if (body.days > left) return err(extensionCapError(Math.max(0, left)));
    const today = londonDateKey(this.deps.now());
    const after = lotStorageCharge({
      facts: {
        ...lot.storage.pricing,
        extensionDays: lot.storage.pricing.extensionDays + body.days,
      },
      clearedAt: lot.clearedAt,
      pausedRanges: storageQuotePauses(lot.storage.quote, today),
      // `find` priced only lots with a calendar.
      calendar: lot.storage.calendar as NonNullable<typeof lot.storage.calendar>,
      asOf: today,
    });
    const outcome = await this.deps.storage.addExtension(
      lotId,
      body.days,
      body.reason,
      this.change(actor),
      {
        before: { collectBy: priced.charge.collectBy, amountPence: priced.charge.amountPence },
        after: { collectBy: after.charge.collectBy, amountPence: after.charge.amountPence },
      },
    );
    if (outcome.outcome === "lot_not_found") return err(storageError("lot_not_found"));
    if (outcome.outcome === "cap_reached") return err(extensionCapError(outcome.daysRemaining));
    return ok(await this.view(venueId));
  }

  async waive(
    actor: CollectionStorageActor,
    venueId: string,
    lotId: string,
    body: WaiveLotStorageBody,
  ): Promise<CollectionStorageResult<StaffOverdueLots>> {
    if (!(await this.placeExists(venueId))) return err(storageError("venue_not_found"));
    const found = await this.find(venueId, lotId);
    if (!found) return err(storageError("lot_not_found"));
    if (found.lot.storage.pricing.waived) return err(storageError("already_waived"));
    const outcome = await this.deps.storage.addWaiver(lotId, body.reason, this.change(actor), {
      before: { amountPence: found.priced.charge.amountPence },
      after: { amountPence: 0 },
    });
    if (outcome.outcome === "lot_not_found") return err(storageError("lot_not_found"));
    if (outcome.outcome === "already_waived") return err(storageError("already_waived"));
    return ok(await this.view(venueId));
  }
}

/** One Not collected row: the lot, how far over, what is owed so far and what staff can still do. */
export function toOverdueLot({ lot, priced }: Priced, today: string): StaffOverdueLot {
  const { charge, terms, band } = priced;
  const { pricing } = lot.storage;
  const daysOver = storageDaysOver(charge, today);
  return {
    lotId: lot.lotId,
    lotNumber: lot.lotNumber,
    title: lot.title,
    buyerName: lot.buyerName,
    collectBy: charge.collectBy,
    daysOver,
    band,
    amountPence: charge.amountPence,
    amountDetail:
      charge.state === "charging" ? formatStorageRunningTotal(charge, terms, band) : null,
    extensionDays: pricing.extensionDays,
    extensionDaysLeft: Math.max(0, MAX_STORAGE_EXTENSION_DAYS - pricing.extensionDays),
    waived: pricing.waived,
    followUp: needsStorageFollowUp(daysOver),
    legacyTerms: pricing.terms === null,
  };
}
