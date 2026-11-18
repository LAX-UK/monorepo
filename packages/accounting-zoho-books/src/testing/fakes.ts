import type {
  BudgetDecision,
  CallBudget,
  Clock,
  LogLevel,
  RateWindow,
  RefreshLock,
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

/**
 * A rate window several clients in one test share, standing in for the shared store of several
 * processes. `fail` makes it reject, as a store that is down does.
 */
export class SharedRateWindow implements RateWindow {
  private readonly sent = new Map<string, number[]>();
  fail = false;

  constructor(private readonly clock: Clock) {}

  async take(organizationId: string, limit: number, windowMs: number): Promise<number> {
    if (this.fail) throw new Error("rate window down");
    const now = this.clock.now();
    const sent = (this.sent.get(organizationId) ?? []).filter((at) => now - at < windowMs);
    this.sent.set(organizationId, sent);
    if (sent.length < limit) {
      sent.push(now);
      return 0;
    }
    return (sent[0] as number) + windowMs - now;
  }
}

/** A refresh lock several clients in one test share. `fail` makes it refuse, as a store that is down does. */
export class SharedRefreshLock implements RefreshLock {
  private readonly tails = new Map<string, Promise<void>>();
  fail = false;
  /** How many times the lock was taken. */
  taken = 0;

  async withLock<T>(organizationId: string, work: () => Promise<T>): Promise<T> {
    if (this.fail) throw new Error("lock down");
    const previous = this.tails.get(organizationId) ?? Promise.resolve();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(
      organizationId,
      previous.then(() => held),
    );
    await previous;
    this.taken += 1;
    try {
      return await work();
    } finally {
      release();
    }
  }
}
