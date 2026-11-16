import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  collectionPlace,
  collectionStorageAudit,
  collectionStorageExtension,
  collectionStorageTerms,
  collectionStorageWaiver,
  legalEntity,
  lot,
  lotFulfilment,
  sale,
  venue,
} from "@auction/db/schema";
import { type SQL, and, asc, desc, eq, gt, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { MAX_STORAGE_EXTENSION_DAYS_PER_LOT } from "../interfaces/collection-storage.repository.js";
import type {
  AddStorageExtensionOutcome,
  AddStorageWaiverOutcome,
  ChangeStorageTermsOutcome,
  ICollectionStorageRepository,
  ScheduleStorageTermsOutcome,
  SetLotStorageOutcome,
  SetStorageChargingOutcome,
  StorageAuditAction,
  StorageAuditDetail,
  StorageAuditRecord,
  StorageChange,
  StorageChargingSettings,
  StorageCountMode,
  StorageExtensionRecord,
  StorageTermsRecord,
  StorageTermsValues,
  StorageVatTreatment,
  StorageWaiverRecord,
  WaitingLotAtPlace,
} from "../interfaces/collection-storage.repository.js";
import { lotAwaitsCollectionSql } from "../lib/lot-awaits-collection.js";
import { readWaitingLotStorage } from "../lib/waiting-lot-storage.js";
import { lockCollectionPlace } from "./collection-place-lock.js";
import { ensureCollectionPlace } from "./drizzle-collection-place-setup.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type TermsRow = typeof collectionStorageTerms.$inferSelect;
type ExtensionRow = typeof collectionStorageExtension.$inferSelect;
type WaiverRow = typeof collectionStorageWaiver.$inferSelect;
type AuditRow = typeof collectionStorageAudit.$inferSelect;
type PlaceRow = typeof collectionPlace.$inferSelect;

const toTerms = (row: TermsRow): StorageTermsRecord => ({
  id: row.id,
  venueId: row.venueId,
  freeDays: row.freeDays,
  countMode: row.countMode as StorageCountMode,
  standardDailyPence: row.standardDailyPence,
  largeDailyPence: row.largeDailyPence,
  handlingFeePence: row.handlingFeePence,
  effectiveFrom: row.effectiveFrom,
  reason: row.reason,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt,
  cancelledAt: row.cancelledAt,
});

const toExtension = (row: ExtensionRow): StorageExtensionRecord => ({
  id: row.id,
  lotId: row.lotId,
  days: row.days,
  reason: row.reason,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt,
});

const toWaiver = (row: WaiverRow): StorageWaiverRecord => ({
  id: row.id,
  lotId: row.lotId,
  reason: row.reason,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt,
});

const toAudit = (row: AuditRow, actorName: string | null = null): StorageAuditRecord => ({
  id: row.id,
  venueId: row.venueId,
  lotId: row.lotId,
  action: row.action as StorageAuditAction,
  actorUserId: row.actorUserId,
  actorName,
  before: row.before,
  after: row.after,
  reason: row.reason,
  createdAt: row.createdAt,
});

const toCharging = (row: PlaceRow): StorageChargingSettings => ({
  raiseInvoices: row.raiseStorageInvoices,
  vatTreatment: row.storageVatTreatment as StorageVatTreatment | null,
});

/** The values of a version as the audit keeps them. */
const termsValues = (row: Omit<TermsRow, "id" | "venueId">): Record<string, unknown> => ({
  freeDays: row.freeDays,
  countMode: row.countMode,
  standardDailyPence: row.standardDailyPence,
  largeDailyPence: row.largeDailyPence,
  handlingFeePence: row.handlingFeePence,
  effectiveFrom: row.effectiveFrom,
});

export class DrizzleCollectionStorageRepository implements ICollectionStorageRepository {
  constructor(private readonly db: Database) {}

  async listTerms(venueId: string): Promise<StorageTermsRecord[]> {
    const rows = await this.db
      .select()
      .from(collectionStorageTerms)
      .where(
        and(
          eq(collectionStorageTerms.venueId, venueId),
          isNull(collectionStorageTerms.cancelledAt),
        ),
      )
      .orderBy(asc(collectionStorageTerms.effectiveFrom));
    return rows.map(toTerms);
  }

  async findTermsInForce(venueId: string, on: string): Promise<StorageTermsRecord | null> {
    const [row] = await this.db
      .select()
      .from(collectionStorageTerms)
      .where(
        and(
          eq(collectionStorageTerms.venueId, venueId),
          isNull(collectionStorageTerms.cancelledAt),
          lte(collectionStorageTerms.effectiveFrom, on),
        ),
      )
      .orderBy(desc(collectionStorageTerms.effectiveFrom))
      .limit(1);
    return row ? toTerms(row) : null;
  }

  async findTerms(termsId: string): Promise<StorageTermsRecord | null> {
    const [row] = await this.db
      .select()
      .from(collectionStorageTerms)
      .where(eq(collectionStorageTerms.id, termsId))
      .limit(1);
    return row ? toTerms(row) : null;
  }

  async scheduleTerms(
    venueId: string,
    values: StorageTermsValues,
    today: string,
    change: StorageChange,
  ): Promise<ScheduleStorageTermsOutcome> {
    if (values.effectiveFrom <= today) return { outcome: "start_not_in_future" };
    const [known] = await this.db
      .select({ id: venue.id })
      .from(venue)
      .where(and(eq(venue.id, venueId), isNull(venue.deletedAt)))
      .limit(1);
    if (!known) return { outcome: "venue_not_found" };
    return this.db.transaction(async (tx): Promise<ScheduleStorageTermsOutcome> => {
      await lockCollectionPlace(tx, venueId);
      if (await this.startIsTaken(tx, venueId, values.effectiveFrom)) {
        return { outcome: "date_taken" };
      }
      // Checked under the place lock, so two changes sent at the same moment cannot both wait.
      if (await this.changeIsWaiting(tx, venueId, today)) {
        return { outcome: "change_already_scheduled" };
      }
      const [row] = await tx
        .insert(collectionStorageTerms)
        .values({ venueId, ...values, createdByUserId: change.actorUserId, createdAt: change.at })
        .returning();
      if (!row) throw new Error("Storage terms were not saved");
      await this.audit(tx, {
        venueId,
        action: "terms_scheduled",
        change,
        before: null,
        after: termsValues(row),
        reason: values.reason,
      });
      return { outcome: "scheduled", terms: toTerms(row) };
    });
  }

  async editScheduledTerms(
    termsId: string,
    values: StorageTermsValues,
    today: string,
    change: StorageChange,
  ): Promise<ChangeStorageTermsOutcome> {
    return this.changeScheduled(termsId, today, async (tx, current) => {
      if (values.effectiveFrom <= today) return { outcome: "start_not_in_future" };
      if (
        values.effectiveFrom !== current.effectiveFrom &&
        (await this.startIsTaken(tx, current.venueId, values.effectiveFrom))
      ) {
        return { outcome: "date_taken" };
      }
      const [row] = await tx
        .update(collectionStorageTerms)
        .set(values)
        .where(eq(collectionStorageTerms.id, termsId))
        .returning();
      if (!row) throw new Error("Storage terms were not saved");
      await this.audit(tx, {
        venueId: current.venueId,
        action: "terms_edited",
        change,
        before: termsValues(current),
        after: termsValues(row),
        reason: values.reason,
      });
      return { outcome: "saved", terms: toTerms(row) };
    });
  }

  async cancelScheduledTerms(
    termsId: string,
    today: string,
    reason: string,
    change: StorageChange,
  ): Promise<ChangeStorageTermsOutcome> {
    return this.changeScheduled(termsId, today, async (tx, current) => {
      const [row] = await tx
        .update(collectionStorageTerms)
        .set({ cancelledAt: change.at })
        .where(eq(collectionStorageTerms.id, termsId))
        .returning();
      if (!row) throw new Error("Storage terms were not saved");
      await this.audit(tx, {
        venueId: current.venueId,
        action: "terms_cancelled",
        change,
        before: termsValues(current),
        after: null,
        reason,
      });
      return { outcome: "saved", terms: toTerms(row) };
    });
  }

  async findCharging(venueId: string): Promise<StorageChargingSettings | null> {
    const [row] = await this.db
      .select()
      .from(collectionPlace)
      .where(eq(collectionPlace.venueId, venueId))
      .limit(1);
    return row ? toCharging(row) : null;
  }

  async setVatTreatment(
    venueId: string,
    vatTreatment: StorageVatTreatment,
    reason: string,
    change: StorageChange,
  ): Promise<SetStorageChargingOutcome> {
    return this.changeCharging(venueId, async (tx, current) => {
      if (current.vatTreatment === vatTreatment) return { outcome: "saved", settings: current };
      const [row] = await tx
        .update(collectionPlace)
        .set({
          storageVatTreatment: vatTreatment,
          updatedByUserId: change.actorUserId,
          updatedAt: change.at,
        })
        .where(eq(collectionPlace.venueId, venueId))
        .returning();
      if (!row) return { outcome: "venue_not_found" };
      await this.audit(tx, {
        venueId,
        action: "vat_treatment_set",
        change,
        before: { vatTreatment: current.vatTreatment },
        after: { vatTreatment },
        reason,
      });
      return { outcome: "saved", settings: toCharging(row) };
    });
  }

  async setRaiseInvoices(
    venueId: string,
    raiseInvoices: boolean,
    reason: string,
    change: StorageChange,
  ): Promise<SetStorageChargingOutcome> {
    return this.changeCharging(venueId, async (tx, current) => {
      if (raiseInvoices && current.vatTreatment === null) {
        return { outcome: "vat_treatment_required" };
      }
      if (current.raiseInvoices === raiseInvoices) return { outcome: "saved", settings: current };
      const [row] = await tx
        .update(collectionPlace)
        .set({
          raiseStorageInvoices: raiseInvoices,
          updatedByUserId: change.actorUserId,
          updatedAt: change.at,
        })
        .where(eq(collectionPlace.venueId, venueId))
        .returning();
      if (!row) return { outcome: "venue_not_found" };
      await this.audit(tx, {
        venueId,
        action: "charging_switched",
        change,
        before: { raiseInvoices: current.raiseInvoices },
        after: { raiseInvoices },
        reason,
      });
      return { outcome: "saved", settings: toCharging(row) };
    });
  }

  async setLotLarge(
    lotId: string,
    large: boolean,
    reason: string | null,
    change: StorageChange,
  ): Promise<SetLotStorageOutcome<{ lotId: string; large: boolean }>> {
    return this.db.transaction(async (tx) => {
      const found = await this.lotVenue(tx, lotId);
      if (!found) return { outcome: "lot_not_found" as const };
      if (found.large === large) return { outcome: "saved" as const, record: { lotId, large } };
      await tx.update(lot).set({ storageLarge: large }).where(eq(lot.id, lotId));
      await this.audit(tx, {
        venueId: found.venueId,
        lotId,
        action: "large_flag_set",
        change,
        before: { large: found.large },
        after: { large },
        reason,
      });
      return { outcome: "saved" as const, record: { lotId, large } };
    });
  }

  async addExtension(
    lotId: string,
    days: number,
    reason: string,
    change: StorageChange,
    detail: StorageAuditDetail = {},
  ): Promise<AddStorageExtensionOutcome> {
    return this.db.transaction(async (tx): Promise<AddStorageExtensionOutcome> => {
      // lotVenue locks the lot row, so concurrent grants for one lot are serialised here.
      const found = await this.lotVenue(tx, lotId);
      if (!found) return { outcome: "lot_not_found" };
      const [given] = await tx
        .select({ total: sql<number>`coalesce(sum(${collectionStorageExtension.days}), 0)::int` })
        .from(collectionStorageExtension)
        .where(eq(collectionStorageExtension.lotId, lotId));
      const givenDays = given?.total ?? 0;
      const daysRemaining = Math.max(0, MAX_STORAGE_EXTENSION_DAYS_PER_LOT - givenDays);
      if (days > daysRemaining) return { outcome: "cap_reached", daysRemaining };
      const [row] = await tx
        .insert(collectionStorageExtension)
        .values({ lotId, days, reason, createdByUserId: change.actorUserId, createdAt: change.at })
        .returning();
      if (!row) throw new Error("Storage extension was not saved");
      await this.audit(tx, {
        venueId: found.venueId,
        lotId,
        action: "extension_granted",
        change,
        before: { extensionDays: givenDays, ...detail.before },
        after: { extensionDays: givenDays + days, days, ...detail.after },
        reason,
      });
      return { outcome: "saved", record: toExtension(row) };
    });
  }

  async addWaiver(
    lotId: string,
    reason: string,
    change: StorageChange,
    detail: StorageAuditDetail = {},
  ): Promise<AddStorageWaiverOutcome> {
    return this.db.transaction(async (tx): Promise<AddStorageWaiverOutcome> => {
      const found = await this.lotVenue(tx, lotId);
      if (!found) return { outcome: "lot_not_found" };
      const [row] = await tx
        .insert(collectionStorageWaiver)
        .values({ lotId, reason, createdByUserId: change.actorUserId, createdAt: change.at })
        .onConflictDoNothing()
        .returning();
      if (!row) return { outcome: "already_waived" };
      await this.audit(tx, {
        venueId: found.venueId,
        lotId,
        action: "waiver_granted",
        change,
        before: { waived: false, ...detail.before },
        after: { waived: true, ...detail.after },
        reason,
      });
      return { outcome: "saved", record: toWaiver(row) };
    });
  }

  async waitingLotsAt(
    venueId: string,
    limit: number,
    today: string,
    lotId?: string,
  ): Promise<{ lots: WaitingLotAtPlace[]; more: boolean }> {
    const rows = await this.db
      .select({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        title: lot.title,
        large: lot.storageLarge,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        buyerName: legalEntity.displayName,
        clearedAt: lotFulfilment.paymentClearedAt,
        storageTermsId: lotFulfilment.storageTermsId,
      })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lot.id, lotFulfilment.lotId))
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .innerJoin(legalEntity, eq(legalEntity.id, lot.buyerLegalEntityId))
      .where(
        and(
          eq(sale.venueId, venueId),
          isNotNull(lotFulfilment.paymentClearedAt),
          eq(lot.status, "ended"),
          lotAwaitsCollectionSql(this.db),
          lotId ? eq(lot.id, lotId) : undefined,
        ),
      )
      .orderBy(asc(lotFulfilment.paymentClearedAt), asc(lot.id))
      .limit(limit + 1);
    const waiting = rows
      .slice(0, limit)
      .flatMap((row) =>
        row.clearedAt && row.buyerLegalEntityId
          ? [{ ...row, clearedAt: row.clearedAt, buyerLegalEntityId: row.buyerLegalEntityId }]
          : [],
      );
    const storage = await readWaitingLotStorage(
      this.db,
      waiting.map((row) => ({ ...row, venueId })),
      today,
    );
    return {
      more: rows.length > limit,
      lots: waiting.flatMap((row) => {
        const priced = storage.get(row.lotId);
        return priced
          ? [
              {
                lotId: row.lotId,
                lotNumber: row.lotNumber,
                title: row.title,
                buyerName: row.buyerName,
                buyerLegalEntityId: row.buyerLegalEntityId,
                clearedAt: row.clearedAt,
                storage: priced,
              },
            ]
          : [];
      }),
    };
  }

  async listExtensions(lotId: string): Promise<StorageExtensionRecord[]> {
    const rows = await this.db
      .select()
      .from(collectionStorageExtension)
      .where(eq(collectionStorageExtension.lotId, lotId))
      .orderBy(asc(collectionStorageExtension.createdAt));
    return rows.map(toExtension);
  }

  async findWaiver(lotId: string): Promise<StorageWaiverRecord | null> {
    const [row] = await this.db
      .select()
      .from(collectionStorageWaiver)
      .where(eq(collectionStorageWaiver.lotId, lotId))
      .limit(1);
    return row ? toWaiver(row) : null;
  }

  async recordTermsForSale(saleId: string, closedOn: string): Promise<number> {
    const result = await this.db.execute(sql`
      with in_force as (
        select t.id
        from collection_storage_terms t
        join sale s on s.venue_id = t.venue_id
        where s.id = ${saleId}
          and t.cancelled_at is null
          and t.effective_from <= ${closedOn}::date
        order by t.effective_from desc
        limit 1
      )
      update lot_fulfilment lf
      set storage_terms_id = in_force.id
      from in_force, lot l
      where l.id = lf.lot_id and l.sale_id = ${saleId} and lf.storage_terms_id is null
      returning lf.id`);
    return result.rows.length;
  }

  async listAudit(venueId: string, limit: number): Promise<StorageAuditRecord[]> {
    return this.readAudit(eq(collectionStorageAudit.venueId, venueId), limit);
  }

  async listPlaceAudit(venueId: string, limit: number): Promise<StorageAuditRecord[]> {
    return this.readAudit(
      and(eq(collectionStorageAudit.venueId, venueId), isNull(collectionStorageAudit.lotId)),
      limit,
    );
  }

  private async readAudit(where: SQL | undefined, limit: number): Promise<StorageAuditRecord[]> {
    const rows = await this.db
      .select({ audit: collectionStorageAudit, actorName: bidIdentityDirectory.name })
      .from(collectionStorageAudit)
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, collectionStorageAudit.actorUserId),
      )
      .where(where)
      .orderBy(desc(collectionStorageAudit.createdAt), desc(collectionStorageAudit.id))
      .limit(limit);
    return rows.map((row) => toAudit(row.audit, row.actorName));
  }

  /** Runs `apply` on a version that has not started, under the place lock. */
  private async changeScheduled(
    termsId: string,
    today: string,
    apply: (tx: Tx, current: TermsRow) => Promise<ChangeStorageTermsOutcome>,
  ): Promise<ChangeStorageTermsOutcome> {
    const found = await this.findTerms(termsId);
    if (!found) return { outcome: "not_found" };
    return this.db.transaction(async (tx): Promise<ChangeStorageTermsOutcome> => {
      await lockCollectionPlace(tx, found.venueId);
      const [current] = await tx
        .select()
        .from(collectionStorageTerms)
        .where(eq(collectionStorageTerms.id, termsId))
        .for("update")
        .limit(1);
      if (!current) return { outcome: "not_found" };
      if (current.cancelledAt !== null || current.effectiveFrom <= today) {
        return { outcome: "not_scheduled" };
      }
      return apply(tx, current);
    });
  }

  /** Runs `apply` on the place's switch and VAT treatment, created if need be, under the place lock. */
  private async changeCharging(
    venueId: string,
    apply: (tx: Tx, current: StorageChargingSettings) => Promise<SetStorageChargingOutcome>,
  ): Promise<SetStorageChargingOutcome> {
    const [known] = await this.db
      .select({ id: venue.id })
      .from(venue)
      .where(and(eq(venue.id, venueId), isNull(venue.deletedAt)))
      .limit(1);
    if (!known) return { outcome: "venue_not_found" };
    await ensureCollectionPlace(this.db, venueId);
    return this.db.transaction(async (tx) => {
      await lockCollectionPlace(tx, venueId);
      const [row] = await tx
        .select()
        .from(collectionPlace)
        .where(eq(collectionPlace.venueId, venueId))
        .for("update")
        .limit(1);
      if (!row) return { outcome: "venue_not_found" as const };
      return apply(tx, toCharging(row));
    });
  }

  private async startIsTaken(tx: Tx, venueId: string, effectiveFrom: string): Promise<boolean> {
    const [existing] = await tx
      .select({ id: collectionStorageTerms.id })
      .from(collectionStorageTerms)
      .where(
        and(
          eq(collectionStorageTerms.venueId, venueId),
          eq(collectionStorageTerms.effectiveFrom, effectiveFrom),
          isNull(collectionStorageTerms.cancelledAt),
        ),
      )
      .limit(1);
    return existing !== undefined;
  }

  /** Whether a live version of the place's terms has not started on `today`. */
  private async changeIsWaiting(tx: Tx, venueId: string, today: string): Promise<boolean> {
    const [waiting] = await tx
      .select({ id: collectionStorageTerms.id })
      .from(collectionStorageTerms)
      .where(
        and(
          eq(collectionStorageTerms.venueId, venueId),
          isNull(collectionStorageTerms.cancelledAt),
          gt(collectionStorageTerms.effectiveFrom, today),
        ),
      )
      .limit(1);
    return waiting !== undefined;
  }

  /** The place a lot is collected from (its sale's venue) and whether it is marked large. */
  private async lotVenue(
    tx: Tx,
    lotId: string,
  ): Promise<{ venueId: string; large: boolean } | null> {
    const [row] = await tx
      .select({ venueId: sale.venueId, large: lot.storageLarge })
      .from(lot)
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .where(eq(lot.id, lotId))
      .for("update", { of: lot })
      .limit(1);
    return row?.venueId ? { venueId: row.venueId, large: row.large } : null;
  }

  private async audit(
    tx: Tx,
    entry: {
      venueId: string;
      lotId?: string;
      action: StorageAuditAction;
      change: StorageChange;
      before: Record<string, unknown> | null;
      after: Record<string, unknown> | null;
      reason: string | null;
    },
  ): Promise<void> {
    await tx.insert(collectionStorageAudit).values({
      venueId: entry.venueId,
      lotId: entry.lotId ?? null,
      action: entry.action,
      actorUserId: entry.change.actorUserId,
      before: entry.before,
      after: entry.after,
      reason: entry.reason,
      createdAt: entry.change.at,
    });
  }
}
