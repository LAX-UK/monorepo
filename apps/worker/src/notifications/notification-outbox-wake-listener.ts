import { NOTIFICATION_OUTBOX_WAKE_CHANNEL } from "@auction/persistence/lib";

/** The parts of a `pg.Client` the listener uses (replaceable in tests). */
export type WakeListenerClient = {
  connect(): Promise<unknown>;
  query(text: string): Promise<unknown>;
  end(): Promise<void>;
  on(event: "notification", listener: (msg: { channel: string }) => void): unknown;
  on(event: "error", listener: (err: Error) => void): unknown;
  on(event: "end", listener: () => void): unknown;
  removeAllListeners(): unknown;
};

type Logger = {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
};

/** Stop reacting to a client being discarded, but keep an error handler so a late error is not fatal. */
function detach(client: WakeListenerClient): void {
  client.removeAllListeners();
  client.on("error", () => {});
}

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
/** How often the idle LISTEN connection is checked with a query. */
export const LISTENER_HEALTH_CHECK_MS = 30_000;
/** A health query that has not answered within this long counts as a dead connection. */
export const LISTENER_HEALTH_TIMEOUT_MS = 10_000;

class HealthCheckTimeout extends Error {
  constructor() {
    super("notification_outbox_wake_health_check_timeout");
  }
}

/**
 * Holds one dedicated Postgres connection on `LISTEN notification_outbox_critical` and calls
 * `onWake` for every signal. The connection is reopened with backoff when it drops, and each
 * (re)connect also wakes once, because a signal sent while nobody listened is not replayed.
 * A lost signal only delays a notification to the next minute sweep; it never loses one.
 *
 * A half-open connection (a failover, or a NAT dropping an idle flow) raises no error and simply
 * stops delivering signals, so the listener runs `SELECT 1` on it every
 * {@link LISTENER_HEALTH_CHECK_MS}; a query that fails or does not answer within
 * {@link LISTENER_HEALTH_TIMEOUT_MS} drops the connection and reconnects.
 */
export class NotificationOutboxWakeListener {
  private client: WakeListenerClient | null = null;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly deps: {
      createClient: () => WakeListenerClient;
      onWake: () => void;
      log: Logger;
      healthCheckMs?: number;
      healthTimeoutMs?: number;
    },
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHealthCheck();
    const client = this.client;
    this.client = null;
    if (client) {
      detach(client);
      await client.end().catch(() => {});
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = this.deps.createClient();
    this.client = client;
    client.on("notification", (msg) => {
      if (msg.channel === NOTIFICATION_OUTBOX_WAKE_CHANNEL) this.deps.onWake();
    });
    client.on("error", (err) => this.handleDrop(client, err));
    client.on("end", () => this.handleDrop(client, null));
    try {
      await client.connect();
      await client.query(`LISTEN ${NOTIFICATION_OUTBOX_WAKE_CHANNEL}`);
    } catch (err) {
      this.handleDrop(client, err);
      return;
    }
    if (this.client !== client) return;
    this.failures = 0;
    this.deps.log.info(
      { channel: NOTIFICATION_OUTBOX_WAKE_CHANNEL },
      "notification_outbox_wake_listening",
    );
    this.startHealthCheck(client);
    this.deps.onWake();
  }

  private startHealthCheck(client: WakeListenerClient): void {
    this.stopHealthCheck();
    const every = this.deps.healthCheckMs ?? LISTENER_HEALTH_CHECK_MS;
    const timeoutMs = this.deps.healthTimeoutMs ?? LISTENER_HEALTH_TIMEOUT_MS;
    let inFlight = false;
    this.healthTimer = setInterval(() => {
      if (inFlight || this.client !== client) return;
      inFlight = true;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new HealthCheckTimeout()), timeoutMs);
        timeout.unref?.();
      });
      Promise.race([client.query("SELECT 1"), timedOut])
        .catch((err: unknown) => this.handleDrop(client, err))
        .finally(() => {
          clearTimeout(timeout);
          inFlight = false;
        });
    }, every);
    this.healthTimer.unref?.();
  }

  private stopHealthCheck(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  private handleDrop(client: WakeListenerClient, err: unknown): void {
    if (this.client !== client) return;
    this.stopHealthCheck();
    this.client = null;
    detach(client);
    void client.end().catch(() => {});
    if (this.stopped) return;
    this.failures += 1;
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** (this.failures - 1));
    this.deps.log.warn(
      { err: err instanceof Error ? err.message : err, retryInMs: delay },
      "notification_outbox_wake_listener_dropped",
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }
}
