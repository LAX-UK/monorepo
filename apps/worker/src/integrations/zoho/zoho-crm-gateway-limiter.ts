import { classifyDeliveryError } from "../../lib/delivery-retry.js";
import type {
  CrmBatchUpdate,
  CrmBatchUpdateInput,
  CrmBatchUpsertInput,
  CrmCoqlPage,
  CrmCoqlQuery,
  CrmCreateInput,
  CrmDeleteRecordInput,
  CrmDeleteRecordResult,
  CrmGateway,
  CrmGatewayMetrics,
  CrmLeadSummary,
  CrmRecordResult,
  CrmSearchByEmailInput,
  CrmSearchByEmailResult,
  CrmUpdateByIdInput,
  CrmUpsertInput,
} from "../crm/crm-gateway.js";
import { ZohoCrmHttpError, ZohoCrmRecordError } from "./types.js";

type LimiterState = {
  consecutiveTransientFailures: number;
  circuitOpenUntilMs: number;
};

const MAX_CONSECUTIVE_TRANSIENT_FAILURES = 5;
const CIRCUIT_OPEN_MS = 60_000;
const MIN_INTERVAL_MS = 100;

export class ZohoCrmGatewayLimiter implements CrmGateway, CrmCoqlQuery, CrmBatchUpdate {
  private state: LimiterState = { consecutiveTransientFailures: 0, circuitOpenUntilMs: 0 };
  /** Earliest time the next call may start. Reserved before any await, so overlapping callers queue 100 ms apart. */
  private nextSlotMs = 0;

  constructor(private readonly inner: CrmGateway & CrmCoqlQuery & CrmBatchUpdate) {}

  getMetrics(): CrmGatewayMetrics {
    return this.inner.getMetrics();
  }

  async upsert(input: CrmUpsertInput): Promise<CrmRecordResult> {
    return this.guard(() => this.inner.upsert(input));
  }

  async upsertMany(input: CrmBatchUpsertInput): Promise<CrmRecordResult[]> {
    return this.guard(() => this.inner.upsertMany(input));
  }

  async updateById(input: CrmUpdateByIdInput): Promise<CrmRecordResult> {
    return this.guard(() => this.inner.updateById(input));
  }

  async updateMany(input: CrmBatchUpdateInput): Promise<CrmRecordResult[]> {
    return this.guard(() => this.inner.updateMany(input));
  }

  async findByEmail(input: CrmSearchByEmailInput): Promise<CrmSearchByEmailResult> {
    return this.guard(() => this.inner.findByEmail(input));
  }

  async findDealIdsByContact(contactId: string): Promise<string[]> {
    return this.guard(() => this.inner.findDealIdsByContact(contactId));
  }

  async executeCoql(selectQuery: string): Promise<string[]> {
    return this.guard(() => this.inner.executeCoql(selectQuery));
  }

  async queryCoql(selectQuery: string): Promise<CrmCoqlPage> {
    return this.guard(() => this.inner.queryCoql(selectQuery));
  }

  async createRecord(input: CrmCreateInput): Promise<CrmRecordResult> {
    return this.guard(() => this.inner.createRecord(input));
  }

  async findLead(leadId: string): Promise<CrmLeadSummary | null> {
    return this.guard(() => this.inner.findLead(leadId));
  }

  async deleteRecord(input: CrmDeleteRecordInput): Promise<CrmDeleteRecordResult> {
    return this.guard(() => this.inner.deleteRecord(input));
  }

  async purgeFromRecycleBin(recordId: string): Promise<void> {
    return this.guard(() => this.inner.purgeFromRecycleBin(recordId));
  }

  private throwIfCircuitOpen(now: number): void {
    if (now < this.state.circuitOpenUntilMs) {
      const retryAfterMs = this.state.circuitOpenUntilMs - now;
      throw Object.assign(new Error("zoho_crm_circuit_open"), {
        status: 503,
        retryable: true,
        retryAfterMs,
      });
    }
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    this.throwIfCircuitOpen(now);
    // Reserve this caller's slot synchronously, before any await, so callers
    // arriving in the same window each get their own slot 100 ms apart.
    const slot = Math.max(now, this.nextSlotMs);
    this.nextSlotMs = slot + MIN_INTERVAL_MS;
    if (slot > now) {
      await new Promise((resolve) => setTimeout(resolve, slot - now));
      // The circuit may have opened while this caller waited for its slot.
      this.throwIfCircuitOpen(Date.now());
    }
    try {
      const result = await fn();
      this.state.consecutiveTransientFailures = 0;
      return result;
    } catch (err) {
      if (isTransientGatewayError(err)) {
        this.state.consecutiveTransientFailures += 1;
        const retryAfterMs = readRetryAfterMs(err);
        if (this.state.consecutiveTransientFailures >= MAX_CONSECUTIVE_TRANSIENT_FAILURES) {
          this.state.circuitOpenUntilMs = Date.now() + Math.max(CIRCUIT_OPEN_MS, retryAfterMs ?? 0);
        }
      }
      throw err;
    }
  }
}

function isTransientGatewayError(err: unknown): boolean {
  if (classifyDeliveryError(err) === "retryable") {
    return true;
  }
  if (err instanceof ZohoCrmHttpError) {
    return err.status === 429 || err.status >= 500;
  }
  if (err instanceof ZohoCrmRecordError) {
    return err.code === "TOO_MANY_REQUESTS" || err.code === "INTERNAL_ERROR";
  }
  if (typeof err === "object" && err !== null) {
    const status = (err as { status?: number }).status;
    if (status === 429 || (status !== undefined && status >= 500)) return true;
  }
  return false;
}

function readRetryAfterMs(err: unknown): number | undefined {
  if (err instanceof ZohoCrmHttpError && err.retryAfterMs != null) {
    return err.retryAfterMs;
  }
  if (typeof err !== "object" || err === null) return undefined;
  const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;
  return typeof retryAfterMs === "number" ? retryAfterMs : undefined;
}
