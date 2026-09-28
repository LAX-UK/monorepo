import { classifyDeliveryError } from "../../lib/delivery-retry.js";
import type {
  CrmBatchUpsertInput,
  CrmConvertLeadInput,
  CrmConvertLeadResult,
  CrmDeleteRecordInput,
  CrmDeleteRecordResult,
  CrmGateway,
  CrmGatewayMetrics,
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

export class ZohoCrmGatewayLimiter implements CrmGateway {
  private state: LimiterState = { consecutiveTransientFailures: 0, circuitOpenUntilMs: 0 };
  private lastCallMs = 0;

  constructor(private readonly inner: CrmGateway) {}

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

  async findByEmail(input: CrmSearchByEmailInput): Promise<CrmSearchByEmailResult> {
    return this.guard(() => this.inner.findByEmail(input));
  }

  async findDealIdsByContact(contactId: string): Promise<string[]> {
    return this.guard(() => this.inner.findDealIdsByContact(contactId));
  }

  async executeCoql(selectQuery: string): Promise<string[]> {
    return this.guard(() => this.inner.executeCoql(selectQuery));
  }

  async convertLead(input: CrmConvertLeadInput): Promise<CrmConvertLeadResult> {
    return this.guard(() => this.inner.convertLead(input));
  }

  async deleteRecord(input: CrmDeleteRecordInput): Promise<CrmDeleteRecordResult> {
    return this.guard(() => this.inner.deleteRecord(input));
  }

  async purgeFromRecycleBin(recordId: string): Promise<void> {
    return this.guard(() => this.inner.purgeFromRecycleBin(recordId));
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (now < this.state.circuitOpenUntilMs) {
      const retryAfterMs = this.state.circuitOpenUntilMs - now;
      throw Object.assign(new Error("zoho_crm_circuit_open"), {
        status: 503,
        retryable: true,
        retryAfterMs,
      });
    }
    const waitMs = this.lastCallMs + MIN_INTERVAL_MS - now;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastCallMs = Date.now();
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
