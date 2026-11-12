import type {
  BudgetDecision,
  CallBudget,
  LogLevel,
  StoredZohoTokens,
  ZohoLogger,
  ZohoMetrics,
  ZohoTokenStore,
} from "../ports.js";

type Row = Omit<StoredZohoTokens, "version"> & { version: number; lastErrorCode?: string };

export class InMemoryTokenStore implements ZohoTokenStore {
  readonly rows = new Map<string, Row>();
  failSaves = false;
  failLoads = false;
  saves = 0;
  loads = 0;

  async load(organizationId: string): Promise<StoredZohoTokens | null> {
    if (this.failLoads) throw new Error("store down");
    this.loads += 1;
    const row = this.rows.get(organizationId);
    return row ? { ...row, version: String(row.version) } : null;
  }

  async saveConnection(organizationId: string, refreshTokenSealed: string): Promise<void> {
    if (this.failSaves) throw new Error("store down");
    this.rows.set(organizationId, {
      refreshTokenSealed,
      accessTokenSealed: null,
      accessTokenExpiresAtMs: null,
      status: "healthy",
      version: (this.rows.get(organizationId)?.version ?? 0) + 1,
    });
  }

  async saveRefreshed(
    organizationId: string,
    expectedVersion: string,
    tokens: {
      accessTokenSealed: string;
      accessTokenExpiresAtMs: number;
      refreshTokenSealed?: string;
    },
  ): Promise<boolean> {
    if (this.failSaves) throw new Error("store down");
    const row = this.rows.get(organizationId);
    if (!row || String(row.version) !== expectedVersion) return false;
    this.saves += 1;
    this.rows.set(organizationId, {
      ...row,
      refreshTokenSealed: tokens.refreshTokenSealed ?? row.refreshTokenSealed,
      accessTokenSealed: tokens.accessTokenSealed,
      accessTokenExpiresAtMs: tokens.accessTokenExpiresAtMs,
      status: "healthy",
      version: row.version + 1,
    });
    return true;
  }

  async markNeedsReauth(
    organizationId: string,
    expectedVersion: string,
    errorCode: string,
  ): Promise<boolean> {
    const row = this.rows.get(organizationId);
    if (!row || String(row.version) !== expectedVersion) return false;
    this.rows.set(organizationId, {
      ...row,
      status: "needs_reauth",
      lastErrorCode: errorCode,
      version: row.version + 1,
    });
    return true;
  }
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly event: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

export class RecordingLogger implements ZohoLogger {
  readonly entries: LogEntry[] = [];
  log(level: LogLevel, event: string, fields: Readonly<Record<string, unknown>>): void {
    this.entries.push({ level, event, fields });
  }
  /** Everything logged, as one string, for "this secret never appears" assertions. */
  dump(): string {
    return JSON.stringify(this.entries);
  }
}

export class RecordingMetrics implements ZohoMetrics {
  readonly counters: Array<{ name: string; labels: Record<string, string>; value: number }> = [];
  readonly gauges: Array<{ name: string; value: number; labels: Record<string, string> }> = [];
  increment(name: string, labels: Readonly<Record<string, string>> = {}, value = 1): void {
    this.counters.push({ name, labels: { ...labels }, value });
  }
  gauge(name: string, value: number, labels: Readonly<Record<string, string>> = {}): void {
    this.gauges.push({ name, value, labels: { ...labels } });
  }
  total(name: string, labels?: Readonly<Record<string, string>>): number {
    return this.counters
      .filter(
        (c) => c.name === name && Object.entries(labels ?? {}).every(([k, v]) => c.labels[k] === v),
      )
      .reduce((sum, c) => sum + c.value, 0);
  }
}

/** A budget that is a fixed number of calls, or fails when asked to. */
export class FixedBudget implements CallBudget {
  used = 0;
  failing = false;
  constructor(private readonly limit: number) {}
  async consume(): Promise<BudgetDecision> {
    if (this.failing) throw new Error("budget store down");
    if (this.used >= this.limit) return { allowed: false, used: this.used, limit: this.limit };
    this.used += 1;
    return { allowed: true, used: this.used, limit: this.limit };
  }
}
