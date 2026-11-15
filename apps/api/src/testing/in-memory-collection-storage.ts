import type {
  ChangeStorageTermsOutcome,
  ICollectionStorageRepository,
  ScheduleStorageTermsOutcome,
  SetStorageChargingOutcome,
  StorageAuditAction,
  StorageAuditRecord,
  StorageChange,
  StorageChargingSettings,
  StorageTermsRecord,
  StorageTermsValues,
} from "@auction/persistence/interfaces";

type Port = Pick<
  ICollectionStorageRepository,
  | "listTerms"
  | "findTerms"
  | "scheduleTerms"
  | "editScheduledTerms"
  | "cancelScheduledTerms"
  | "findCharging"
  | "setRaiseInvoices"
  | "listAudit"
>;

const termsValues = (record: StorageTermsValues): Record<string, unknown> => ({
  freeDays: record.freeDays,
  countMode: record.countMode,
  standardDailyPence: record.standardDailyPence,
  largeDailyPence: record.largeDailyPence,
  handlingFeePence: record.handlingFeePence,
  effectiveFrom: record.effectiveFrom,
});

/**
 * Storage terms, the charging switch and the audit in memory, with the same rules as the
 * database repository: starts after `today`, one live version per start date, versions that have
 * started are history, charging needs a VAT treatment, and every change writes an audit row.
 */
export class InMemoryCollectionStorage implements Port {
  terms: StorageTermsRecord[] = [];
  charging = new Map<string, StorageChargingSettings>();
  audit: StorageAuditRecord[] = [];
  /** Names the identity directory knows, by user id. */
  names = new Map<string, string>();
  private ids = 0;

  private nextId(prefix: string): string {
    this.ids += 1;
    return `${prefix}-${this.ids}`;
  }

  private record(
    venueId: string,
    action: StorageAuditAction,
    change: StorageChange,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    reason: string | null,
  ): void {
    this.audit.push({
      id: this.nextId("audit"),
      venueId,
      lotId: null,
      action,
      actorUserId: change.actorUserId,
      actorName: this.names.get(change.actorUserId) ?? null,
      before,
      after,
      reason,
      createdAt: change.at,
    });
  }

  /** Puts a version in place directly, as if it had been scheduled earlier. */
  seed(venueId: string, values: StorageTermsValues, at = new Date("2026-01-01T09:00:00Z")) {
    const record: StorageTermsRecord = {
      ...values,
      id: this.nextId("terms"),
      venueId,
      createdByUserId: null,
      createdAt: at,
      cancelledAt: null,
    };
    this.terms.push(record);
    return record;
  }

  async listTerms(venueId: string): Promise<StorageTermsRecord[]> {
    return this.terms
      .filter((t) => t.venueId === venueId && t.cancelledAt === null)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
      .map((t) => ({ ...t }));
  }

  async findTerms(termsId: string): Promise<StorageTermsRecord | null> {
    const found = this.terms.find((t) => t.id === termsId);
    return found ? { ...found } : null;
  }

  private taken(venueId: string, effectiveFrom: string, except?: string): boolean {
    return this.terms.some(
      (t) =>
        t.venueId === venueId &&
        t.cancelledAt === null &&
        t.effectiveFrom === effectiveFrom &&
        t.id !== except,
    );
  }

  async scheduleTerms(
    venueId: string,
    values: StorageTermsValues,
    today: string,
    change: StorageChange,
  ): Promise<ScheduleStorageTermsOutcome> {
    if (values.effectiveFrom <= today) return { outcome: "start_not_in_future" };
    if (this.taken(venueId, values.effectiveFrom)) return { outcome: "date_taken" };
    const record: StorageTermsRecord = {
      ...values,
      id: this.nextId("terms"),
      venueId,
      createdByUserId: change.actorUserId,
      createdAt: change.at,
      cancelledAt: null,
    };
    this.terms.push(record);
    this.record(venueId, "terms_scheduled", change, null, termsValues(record), values.reason);
    return { outcome: "scheduled", terms: { ...record } };
  }

  private waiting(termsId: string, today: string): StorageTermsRecord | ChangeStorageTermsOutcome {
    const found = this.terms.find((t) => t.id === termsId);
    if (!found) return { outcome: "not_found" };
    if (found.cancelledAt !== null || found.effectiveFrom <= today) {
      return { outcome: "not_scheduled" };
    }
    return found;
  }

  async editScheduledTerms(
    termsId: string,
    values: StorageTermsValues,
    today: string,
    change: StorageChange,
  ): Promise<ChangeStorageTermsOutcome> {
    const found = this.waiting(termsId, today);
    if ("outcome" in found) return found;
    if (values.effectiveFrom <= today) return { outcome: "start_not_in_future" };
    if (this.taken(found.venueId, values.effectiveFrom, found.id)) return { outcome: "date_taken" };
    const before = termsValues(found);
    Object.assign(found, values);
    this.record(found.venueId, "terms_edited", change, before, termsValues(found), values.reason);
    return { outcome: "saved", terms: { ...found } };
  }

  async cancelScheduledTerms(
    termsId: string,
    today: string,
    reason: string,
    change: StorageChange,
  ): Promise<ChangeStorageTermsOutcome> {
    const found = this.waiting(termsId, today);
    if ("outcome" in found) return found;
    found.cancelledAt = change.at;
    this.record(found.venueId, "terms_cancelled", change, termsValues(found), null, reason);
    return { outcome: "saved", terms: { ...found } };
  }

  async findCharging(venueId: string): Promise<StorageChargingSettings | null> {
    const found = this.charging.get(venueId);
    return found ? { ...found } : null;
  }

  async setRaiseInvoices(
    venueId: string,
    raiseInvoices: boolean,
    reason: string,
    change: StorageChange,
  ): Promise<SetStorageChargingOutcome> {
    const current = this.charging.get(venueId) ?? { raiseInvoices: false, vatTreatment: null };
    if (raiseInvoices && current.vatTreatment === null) {
      return { outcome: "vat_treatment_required" };
    }
    if (current.raiseInvoices === raiseInvoices) return { outcome: "saved", settings: current };
    const settings = { ...current, raiseInvoices };
    this.charging.set(venueId, settings);
    this.record(
      venueId,
      "charging_switched",
      change,
      { raiseInvoices: current.raiseInvoices },
      { raiseInvoices },
      reason,
    );
    return { outcome: "saved", settings };
  }

  async listAudit(venueId: string, limit: number): Promise<StorageAuditRecord[]> {
    return this.audit
      .filter((row) => row.venueId === venueId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
