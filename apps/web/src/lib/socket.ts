import type { Socket } from "socket.io-client";

/**
 * The browser's one live connection (bids, lot and sale events, user notifications).
 *
 * `getSocket()` returns a small stand-in with the part of the Socket.IO client the app uses, so
 * `socket.io-client` is not in any page's first scripts. The first call starts fetching the client
 * (`socket-connection.ts`) and opening the connection, which is when the client used to connect.
 * Live surfaces call it on mount, so a live sale or an open lot starts loading at once.
 *
 * Until the client has arrived, listeners added and removed and messages emitted are recorded in
 * one list and replayed on the real socket in the same order before anything else can run. The
 * real socket then holds emits until it connects, exactly as before, and every listener is in
 * place for the first `connect`. After that every call goes straight to the real socket.
 *
 * If the client cannot be fetched, listeners hear exactly what Socket.IO raises when a handshake
 * fails, with the same arguments: the manager's `error` and the socket's `connect_error` for every
 * failure, `reconnect_attempt` (1, 2, …) before each retry, `reconnect_error` when a retry fails
 * too, and `reconnect` once the connection finally opens. Retries use Socket.IO's default backoff
 * (1 s doubling to 5 s, ±50%) and never give up, so `reconnect_failed` is never raised.
 */

// biome-ignore lint/suspicious/noExplicitAny: Socket.IO listeners take any arguments.
type Listener = (...args: any[]) => void;

export type LiveSocketEmitter = {
  // biome-ignore lint/suspicious/noExplicitAny: same signature as Socket.IO's emit.
  emit(event: string, ...args: any[]): unknown;
};

export type LiveSocketManager = {
  on(event: string, listener: Listener): unknown;
  off(event: string, listener?: Listener): unknown;
};

export type LiveSocket = LiveSocketEmitter & {
  readonly connected: boolean;
  on(event: string, listener: Listener): LiveSocket;
  off(event: string, listener?: Listener): LiveSocket;
  timeout(ms: number): LiveSocketEmitter;
  readonly io: LiveSocketManager;
};

type PendingOp =
  | { kind: "on" | "off"; event: string; listener?: Listener | undefined }
  | { kind: "ioOn" | "ioOff"; event: string; listener?: Listener | undefined }
  | {
      kind: "emit";
      event: string;
      // biome-ignore lint/suspicious/noExplicitAny: emit arguments are passed through as given.
      args: any[];
      /** For `timeout(ms).emit`: the ack deadline, `Date.now()`-based, set when it was called. */
      deadline?: number;
      timer?: ReturnType<typeof setTimeout>;
    };

export type SocketConnectionModule = { createSocketConnection: () => Socket };

const RECONNECT_DELAY_MS = 1000;
const RECONNECT_DELAY_MAX_MS = 5000;
const RANDOMIZATION_FACTOR = 0.5;
/** 1 s × 2^3 already passes the 5 s ceiling, so a larger exponent changes nothing but can overflow. */
const MAX_BACKOFF_EXPONENT = 8;
/** The jitter can take at most half the delay away, so no retry comes sooner than this. */
const MIN_RETRY_DELAY_MS = RECONNECT_DELAY_MS * (1 - RANDOMIZATION_FACTOR);

/**
 * Socket.IO's default reconnection backoff (`backo2`): 1 s doubling to 5 s, ±50%. Unlike the
 * original, the exponent is capped, so after ~1000 failures `2 ** attempt` cannot become
 * `Infinity` (and the jitter `NaN`, which `setTimeout` treats as no delay at all).
 */
export function retryDelayMs(attempt: number): number {
  let ms = RECONNECT_DELAY_MS * 2 ** Math.min(Math.max(attempt, 0), MAX_BACKOFF_EXPONENT);
  const rand = Math.random();
  const deviation = Math.floor(rand * RANDOMIZATION_FACTOR * ms);
  ms = (Math.floor(rand * 10) & 1) === 0 ? ms - deviation : ms + deviation;
  return Math.max(MIN_RETRY_DELAY_MS, Math.min(ms, RECONNECT_DELAY_MAX_MS));
}

/**
 * Most messages that can wait for the client. Past this the oldest is dropped (see `record`). Live
 * surfaces join their rooms again on `connect`, so only stale churn is lost.
 */
export const MAX_PENDING_EMITS = 100;

/** Builds a lazy socket around `load`. Exported for tests; the app uses `getSocket()`. */
export function createLazySocket(load: () => Promise<SocketConnectionModule>): LiveSocket {
  let real: Socket | null = null;
  let loading = false;
  let attempt = 0;
  /**
   * What to replay, in call order. Listeners are kept as their net effect, so this holds at most
   * the listeners currently wanted plus `MAX_PENDING_EMITS` messages.
   */
  const pending: PendingOp[] = [];

  /** Calls the listeners registered so far, as the client would (load failures only). */
  function notify(kind: "on" | "ioOn", event: string, ...args: unknown[]) {
    const listeners: Listener[] = [];
    for (const op of pending) {
      if (op.kind === kind && op.event === event && op.listener) listeners.push(op.listener);
    }
    for (const listener of listeners) listener(...args);
  }

  function replay(socket: Socket) {
    for (const op of pending) {
      switch (op.kind) {
        case "on":
          if (op.listener) socket.on(op.event, op.listener);
          break;
        case "off":
          socket.off(op.event, op.listener);
          break;
        case "ioOn":
          if (op.listener) socket.io.on(op.event as never, op.listener);
          break;
        case "ioOff":
          socket.io.off(op.event as never, op.listener);
          break;
        case "emit":
          if (op.deadline === undefined) socket.emit(op.event, ...op.args);
          else {
            clearTimeout(op.timer);
            // The ack timer started when it was called, so it keeps only the time left.
            const left = Math.max(1, op.deadline - Date.now());
            socket.timeout(left).emit(op.event, ...op.args);
          }
          break;
      }
    }
    pending.length = 0;
  }

  /**
   * After a failed fetch Socket.IO would report the eventual connection as a reconnection, so the
   * first time the real manager opens it hears `reconnect` with the attempt count, unless the
   * manager has started its own reconnection by then and reports it itself.
   */
  function reportReconnectOnOpen(socket: Socket, attempts: number) {
    const manager = socket.io as unknown as {
      on(event: string, fn: Listener): unknown;
      off(event: string, fn: Listener): unknown;
      emitReserved(event: string, ...args: unknown[]): unknown;
    };
    const stop = () => {
      manager.off("open", onOpen);
      manager.off("reconnect_attempt", stop);
    };
    const onOpen = () => {
      stop();
      manager.emitReserved("reconnect", attempts);
    };
    manager.on("open", onOpen);
    manager.on("reconnect_attempt", stop);
  }

  function start() {
    if (loading || real) return;
    loading = true;
    const isRetry = attempt > 0;
    load().then(
      (mod) => {
        loading = false;
        const socket = mod.createSocketConnection();
        replay(socket);
        if (isRetry) reportReconnectOnOpen(socket, attempt);
        real = socket;
      },
      (error: unknown) => {
        loading = false;
        const err = error instanceof Error ? error : new Error(String(error));
        // The same order as a failed Socket.IO handshake: the manager's `error`, which the socket
        // repeats as `connect_error`; a failed retry then also raises `reconnect_error`.
        notify("ioOn", "error", err);
        notify("on", "connect_error", err);
        const delay = retryDelayMs(attempt);
        attempt += 1;
        setTimeout(() => {
          notify("ioOn", "reconnect_attempt", attempt);
          start();
        }, delay);
        if (isRetry) notify("ioOn", "reconnect_error", err);
      },
    );
  }

  /**
   * Buffers one call, keeping the buffer bounded:
   * - `off(event, fn)` cancels the first buffered `on(event, fn)`, as the emitter would remove the
   *   first match, and `off(event)` cancels every buffered `on(event)`. Nothing else is registered
   *   on the socket yet, so the `off` itself has nothing left to do and is not kept. The manager
   *   works the same, except a bare `io.off(event)`, which also removes Socket.IO's own manager
   *   listeners and so is kept (only the latest one per event).
   * - Messages are capped at `MAX_PENDING_EMITS`. The oldest is dropped first; a dropped
   *   `timeout(ms).emit` hears `operation has timed out` at once, a plain ack is never called
   *   (Socket.IO does not call it for a message it never sent).
   */
  function record(op: PendingOp) {
    if (op.kind === "off" || op.kind === "ioOff") {
      const onKind = op.kind === "off" ? "on" : "ioOn";
      for (let i = 0; i < pending.length; i += 1) {
        const other = pending[i];
        if (other?.kind !== onKind || other.event !== op.event) continue;
        if (op.listener && other.listener !== op.listener) continue;
        pending.splice(i, 1);
        i -= 1;
        if (op.listener) break;
      }
      if (op.kind === "off" || op.listener) return;
      const earlier = pending.findIndex(
        (other) => other.kind === "ioOff" && other.event === op.event && !other.listener,
      );
      if (earlier !== -1) pending.splice(earlier, 1);
    }
    pending.push(op);
    if (op.kind !== "emit") return;
    let emits = 0;
    for (const other of pending) if (other.kind === "emit") emits += 1;
    if (emits <= MAX_PENDING_EMITS) return;
    const oldest = pending.findIndex((other) => other.kind === "emit");
    const [dropped] = pending.splice(oldest, 1);
    if (dropped?.kind === "emit" && dropped.timer !== undefined) {
      clearTimeout(dropped.timer);
      dropped.args[dropped.args.length - 1](new Error("operation has timed out"));
    }
  }

  /**
   * `timeout(ms).emit` before the client is in. As in Socket.IO, where the timer starts when
   * `emit` is called even while disconnected, the ack hears `operation has timed out` `ms` after
   * the call if the message has not gone by then, and the message is dropped so it is never sent.
   */
  // biome-ignore lint/suspicious/noExplicitAny: emit arguments are passed through as given.
  function recordTimedEmit(event: string, args: any[], ms: number) {
    const op: PendingOp = { kind: "emit", event, args, deadline: Date.now() + ms };
    const ack = args[args.length - 1];
    if (typeof ack === "function") {
      op.timer = setTimeout(() => {
        const index = pending.indexOf(op);
        if (index !== -1) pending.splice(index, 1);
        ack(new Error("operation has timed out"));
      }, ms);
    }
    record(op);
  }

  const manager: LiveSocketManager = {
    on(event, listener) {
      if (real) real.io.on(event as never, listener);
      else record({ kind: "ioOn", event, listener });
      return manager;
    },
    off(event, listener) {
      if (real) real.io.off(event as never, listener);
      else record({ kind: "ioOff", event, listener });
      return manager;
    },
  };

  const facade: LiveSocket = {
    get connected() {
      return real?.connected ?? false;
    },
    io: manager,
    on(event, listener) {
      if (real) real.on(event, listener);
      else record({ kind: "on", event, listener });
      return facade;
    },
    off(event, listener) {
      if (real) real.off(event, listener);
      else record({ kind: "off", event, listener });
      return facade;
    },
    emit(event, ...args) {
      if (real) real.emit(event, ...args);
      else record({ kind: "emit", event, args });
      return facade;
    },
    timeout(ms) {
      return {
        emit(event, ...args) {
          if (real) real.timeout(ms).emit(event, ...args);
          else recordTimedEmit(event, args, ms);
          return facade;
        },
      };
    },
  };

  start();
  return facade;
}

let socket: LiveSocket | null = null;

export function getSocket(): LiveSocket {
  if (!socket) socket = createLazySocket(() => import("@/lib/socket-connection"));
  return socket;
}
