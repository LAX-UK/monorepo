import {
  DEFAULT_COLLECTION_RULES,
  type StorageCalendar,
  createCollectionCalendar,
} from "@auction/domain";
import type {
  AddStorageExtensionOutcome,
  AddStorageWaiverOutcome,
  ICollectionStorageRepository,
  StorageAuditDetail,
  StorageAuditRecord,
  StorageChange,
  StorageChargingSettings,
  WaitingLotAtPlace,
} from "@auction/persistence/interfaces";

type Port = Pick<
  ICollectionStorageRepository,
  "waitingLotsAt" | "addExtension" | "addWaiver" | "findCharging"
>;

/** Open Monday to Friday, 10:00 to 19:00, with no closures: a collect-by day on a weekend moves on. */
export const WEEKDAY_CALENDAR: StorageCalendar = createCollectionCalendar({
  hours: [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    opensLocal: "10:00",
    closesLocal: "19:00",
  })),
  exceptions: [],
  rules: DEFAULT_COLLECTION_RULES,
});

/** A waiting lot with 14 days free at £3 a day (£6 large), charging off, unless told otherwise. */
type Storage = WaitingLotAtPlace["storage"];

export function waitingLot(
  overrides: Partial<Omit<WaitingLotAtPlace, "storage">> & {
    storage?: Partial<Omit<Storage, "pricing">> & { pricing?: Partial<Storage["pricing"]> };
  } = {},
): WaitingLotAtPlace {
  const { storage = {}, ...rest } = overrides;
  const { pricing = {}, ...place } = storage;
  return {
    lotId: "e0000000-0000-4000-8000-000000000001",
    lotNumber: 12,
    title: "Harbour at Dusk",
    buyerName: "Example Collector",
    buyerLegalEntityId: "e0000000-0000-4000-8000-0000000000b1",
    clearedAt: new Date("2026-10-01T10:00:00Z"),
    ...rest,
    storage: {
      chargingOn: false,
      quote: null,
      calendar: WEEKDAY_CALENDAR,
      ...place,
      pricing: {
        terms: {
          freeDays: 14,
          countMode: "calendar",
          standardDailyPence: 300,
          largeDailyPence: 600,
          handlingFeePence: 0,
          effectiveFrom: "2026-09-01",
        },
        large: false,
        extensionDays: 0,
        waived: false,
        ...pricing,
      },
    },
  };
}

/**
 * Waiting lots, extensions and waivers in memory, with the database repository's rules: a lot's
 * extensions stop at 30 days in all, a lot is waived once, and each grant writes an audit row with
 * the stored values before and after and the caller's detail added.
 */
export class InMemoryStorageFollowUp implements Port {
  /** Waiting lots by place. */
  lots = new Map<string, WaitingLotAtPlace[]>();
  charging = new Map<string, StorageChargingSettings>();
  audit: StorageAuditRecord[] = [];

  private venueOf(lotId: string): string | null {
    for (const [venueId, lots] of this.lots)
      if (lots.some((l) => l.lotId === lotId)) return venueId;
    return null;
  }

  private lot(lotId: string): WaitingLotAtPlace | null {
    for (const lots of this.lots.values()) {
      const found = lots.find((l) => l.lotId === lotId);
      if (found) return found;
    }
    return null;
  }

  private write(
    lotId: string,
    action: StorageAuditRecord["action"],
    change: StorageChange,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    reason: string,
  ) {
    this.audit.unshift({
      id: `audit-${this.audit.length + 1}`,
      venueId: this.venueOf(lotId) ?? "",
      lotId,
      action,
      actorUserId: change.actorUserId,
      actorName: null,
      before,
      after,
      reason,
      createdAt: change.at,
    });
  }

  async waitingLotsAt(venueId: string, limit: number, lotId?: string) {
    const lots = (this.lots.get(venueId) ?? []).filter((l) => !lotId || l.lotId === lotId);
    return { lots: lots.slice(0, limit), more: lots.length > limit };
  }

  async findCharging(venueId: string) {
    return this.charging.get(venueId) ?? null;
  }

  async addExtension(
    lotId: string,
    days: number,
    reason: string,
    change: StorageChange,
    detail: StorageAuditDetail = {},
  ): Promise<AddStorageExtensionOutcome> {
    const lot = this.lot(lotId);
    if (!lot) return { outcome: "lot_not_found" };
    const given = lot.storage.pricing.extensionDays;
    const daysRemaining = Math.max(0, 30 - given);
    if (days > daysRemaining) return { outcome: "cap_reached", daysRemaining };
    lot.storage.pricing.extensionDays = given + days;
    this.write(
      lotId,
      "extension_granted",
      change,
      { extensionDays: given, ...detail.before },
      { extensionDays: given + days, days, ...detail.after },
      reason,
    );
    return {
      outcome: "saved",
      record: {
        id: `ext-${this.audit.length}`,
        lotId,
        days,
        reason,
        createdByUserId: change.actorUserId,
        createdAt: change.at,
      },
    };
  }

  async addWaiver(
    lotId: string,
    reason: string,
    change: StorageChange,
    detail: StorageAuditDetail = {},
  ): Promise<AddStorageWaiverOutcome> {
    const lot = this.lot(lotId);
    if (!lot) return { outcome: "lot_not_found" };
    if (lot.storage.pricing.waived) return { outcome: "already_waived" };
    lot.storage.pricing.waived = true;
    this.write(
      lotId,
      "waiver_granted",
      change,
      { waived: false, ...detail.before },
      { waived: true, ...detail.after },
      reason,
    );
    return {
      outcome: "saved",
      record: {
        id: `waiver-${this.audit.length}`,
        lotId,
        reason,
        createdByUserId: change.actorUserId,
        createdAt: change.at,
      },
    };
  }
}
