import type pg from "pg";
import type { WorkerDb } from "../workers/types.js";

/** An id that matches no row, valid as both a uuid and a text key. */
export const NIL = "00000000-0000-0000-0000-000000000000";

const PERMISSION_DENIED = "42501";

class RolledBack extends Error {}

export type ProbeOutcome = {
  /** PostgreSQL's message when the call was denied, otherwise null. */
  denied: string | null;
  /**
   * True when a statement got past PostgreSQL's privilege check: one ran to completion, or the call
   * failed with an error only raised after it. A call that sent no statement, or whose statements
   * failed while being parsed or bound, is false.
   */
  reachedDatabase: boolean;
  /** Statements sent while the call ran, transaction control excluded. */
  statements: number;
  /** Why the call failed, when it did. */
  failure: string | null;
};

function postgresCode(error: unknown): string | undefined {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    const { code } = cause as { code?: unknown };
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

/**
 * SQLSTATE classes raised only once a statement has been parsed, analysed and checked for
 * privileges: integrity violations (23), cardinality (21), transaction rollback (40), object state
 * (55) and errors raised by PL/pgSQL (P0). Everything else, including data exceptions (22), syntax
 * and name errors (class 42 other than 42501), connection errors (08) and "current transaction is
 * aborted" (25P02), is raised while arguments are bound or the statement is parsed, before
 * PostgreSQL looks at a grant, so it proves nothing.
 */
const AFTER_PRIVILEGE_CHECK_CLASSES = ["21", "23", "40", "55", "P0"];

/** True when an error with this SQLSTATE can only have come after the privilege check ran. */
export function reachedPrivilegeCheck(error: unknown): boolean {
  const code = postgresCode(error);
  if (code === undefined) return false;
  if (code === PERMISSION_DENIED) return true;
  return AFTER_PRIVILEGE_CHECK_CLASSES.some((prefix) => code.startsWith(prefix));
}

type Counted = { sent: number; completed: number };
const counts = new WeakMap<object, Counted>();

const TRANSACTION_CONTROL = /^\s*(begin|start transaction|commit|rollback|savepoint|release)\b/i;

function statementText(args: unknown[]): string | undefined {
  const [first] = args;
  if (typeof first === "string") return first;
  const text = (first as { text?: unknown } | undefined)?.text;
  return typeof text === "string" ? text : undefined;
}

function countQueries<T extends { query: (...args: never[]) => unknown }>(
  target: T,
  tally: Counted,
): void {
  const original = target.query.bind(target) as (...args: unknown[]) => unknown;
  (target as { query: unknown }).query = (...args: unknown[]) => {
    const text = statementText(args);
    const result = original(...args);
    if (text === undefined || TRANSACTION_CONTROL.test(text) || !(result instanceof Promise))
      return result;
    tally.sent += 1;
    return result.then((value) => {
      tally.completed += 1;
      return value;
    });
  };
}

/**
 * Makes the worker pool count the statements it sends (transaction control excluded) and how many
 * of them PostgreSQL ran to completion. A probe is only proof of a grant when it sent a statement
 * and that statement got past the privilege check, so a call that returns early in code, or whose
 * statement fails to parse, is not mistaken for one.
 */
export function countStatements(db: WorkerDb): void {
  const pool = (db as unknown as { $client: pg.Pool }).$client;
  const tally: Counted = { sent: 0, completed: 0 };
  counts.set(db, tally);
  countQueries(pool as never, tally);
  const connect = pool.connect.bind(pool) as (...args: unknown[]) => unknown;
  (pool as { connect: unknown }).connect = (...args: unknown[]) => {
    const result = connect(...args);
    if (!(result instanceof Promise)) return result;
    return result.then((client) => {
      countQueries(client as never, tally);
      return client;
    });
  };
}

/** The innermost message of an error chain: for a failed query, PostgreSQL's own. */
function describeFailure(error: unknown): string {
  let innermost = error;
  while (innermost instanceof Error && innermost.cause instanceof Error)
    innermost = innermost.cause;
  return innermost instanceof Error ? (innermost.message.split("\n")[0] ?? "") : String(innermost);
}

function deniedMessage(error: unknown): string | null {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if ((cause as { code?: unknown }).code === PERMISSION_DENIED) return cause.message;
  }
  return null;
}

/**
 * Runs `call` on a transaction of the worker pool and always rolls it back, so an insert leaves
 * nothing behind and a denied statement cannot poison the next call. Only a denial matters:
 * PostgreSQL checks privileges before it checks constraints or looks for rows, so any other
 * error still proves the statement was allowed.
 */
export async function runRolledBack(
  db: WorkerDb,
  call: (tx: WorkerDb) => Promise<unknown>,
  /** A message the call throws itself after its statement ran, which still proves the grant. */
  refusalAfterStatement?: RegExp,
): Promise<ProbeOutcome> {
  let outcome: ProbeOutcome = {
    denied: null,
    reachedDatabase: false,
    statements: 0,
    failure: null,
  };
  const tally = counts.get(db);
  if (!tally) throw new Error("call countStatements(db) before probing with runRolledBack");
  tally.sent = 0;
  tally.completed = 0;
  try {
    await db.transaction(async (tx) => {
      try {
        await call(tx as unknown as WorkerDb);
        outcome = {
          denied: null,
          reachedDatabase: tally.completed > 0,
          statements: tally.sent,
          failure: null,
        };
      } catch (error) {
        outcome = {
          denied: deniedMessage(error),
          statements: tally.sent,
          reachedDatabase:
            tally.completed > 0 ||
            reachedPrivilegeCheck(error) ||
            (refusalAfterStatement?.test(describeFailure(error)) ?? false),
          failure: describeFailure(error),
        };
      }
      throw new RolledBack();
    });
  } catch (error) {
    if (!(error instanceof RolledBack)) throw error;
  }
  return outcome;
}
