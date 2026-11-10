import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

const CLAIM_TABLES = new Set(["processed_stripe_events", "processed_webhook_events"]);

export type ClaimGate = {
  /** Runs transactions; the first one to claim an event is held open at the claim. */
  runner: ITransactionRunner;
  /** Settles once the first transaction has written its claim and is being held. */
  claimed: Promise<void>;
  /** Lets the held transaction go on: it then fails, or carries on, as `afterRelease` said. */
  release(): void;
};

/** Follows a query builder through its chain, running `afterAwaited` when the chain is awaited. */
function afterAwait<T extends object>(builder: T, afterAwaited: () => Promise<void>): T {
  return new Proxy(builder, {
    get(target, prop) {
      if (prop === "then") {
        const awaitable = target as unknown as PromiseLike<unknown>;
        if (typeof awaitable.then !== "function") return undefined;
        return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(awaitable)
            .then(async (value) => {
              await afterAwaited();
              return value;
            })
            .then(resolve, reject);
      }
      const member = Reflect.get(target, prop, target);
      if (typeof member !== "function") return member;
      return (...args: unknown[]) => {
        const next = member.apply(target, args);
        return typeof next === "object" && next !== null ? afterAwait(next, afterAwaited) : next;
      };
    },
  });
}

/**
 * Wraps a transaction runner so the first transaction that claims a webhook event is paused right
 * after the claim is written, with the claim still uncommitted. A test can then deliver the same
 * event again and see what the second delivery does while the first is open, and after the first
 * fails (`afterRelease: "fail"`) or carries on and commits (`"pass"`).
 */
export function claimGatedRunner(
  base: ITransactionRunner,
  afterRelease: "fail" | "pass",
): ClaimGate {
  let release!: () => void;
  let reached!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const claimed = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let held = false;

  const holdFirstClaim = async (): Promise<void> => {
    if (held) return;
    held = true;
    reached();
    await released;
    if (afterRelease === "fail") throw new Error("injected failure after the claim");
  };

  const gate = <T extends object>(tx: T): T =>
    new Proxy(tx, {
      get(target, prop) {
        const member = Reflect.get(target, prop, target);
        if (prop !== "insert" || typeof member !== "function") return member;
        return (table: PgTable) => {
          const builder = member.call(target, table);
          return CLAIM_TABLES.has(getTableName(table))
            ? afterAwait(builder, holdFirstClaim)
            : builder;
        };
      },
    });

  return {
    runner: { runInTransaction: (fn) => base.runInTransaction((tx) => fn(gate(tx))) },
    claimed,
    release,
  };
}
