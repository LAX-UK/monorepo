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

/**
 * Holds one dedicated Postgres connection on `LISTEN notification_outbox_critical` and calls
 * `onWake` for every signal. The connection is reopened with backoff when it drops, and each
 * (re)connect also wakes once, because a signal sent while nobody listened is not replayed.
 * A lost signal only delays a notification to the next minute sweep; it never loses one.
 */
export class NotificationOutboxWakeListener {
  private client: WakeListenerClient | null = null;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;

  constructor(
    private readonly deps: {
      createClient: () => WakeListenerClient;
      onWake: () => void;
      log: Logger;
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
    this.deps.onWake();
  }

  private handleDrop(client: WakeListenerClient, err: unknown): void {
    if (this.client !== client) return;
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
