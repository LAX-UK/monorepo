import type { WorkerDb } from "../workers/types.js";

/** An id that matches no row, valid as both a uuid and a text key. */
export const NIL = "00000000-0000-0000-0000-000000000000";

const PERMISSION_DENIED = "42501";

class RolledBack extends Error {}

export type ProbeOutcome = {
  /** PostgreSQL's message when the call was denied, otherwise null. */
  denied: string | null;
  /** True when the statement got as far as PostgreSQL's privilege check, false when it failed before that. */
  reachedDatabase: boolean;
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
 * Data-exception errors (class 22, e.g. an invalid uuid text) are raised while arguments are bound,
 * before PostgreSQL checks privileges, so they prove nothing about grants.
 */
function reachedPrivilegeCheck(error: unknown): boolean {
  const code = postgresCode(error);
  return code !== undefined && !code.startsWith("22");
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
  let outcome: ProbeOutcome = { denied: null, reachedDatabase: false, failure: null };
  try {
    await db.transaction(async (tx) => {
      try {
        await call(tx as unknown as WorkerDb);
        outcome = { denied: null, reachedDatabase: true, failure: null };
      } catch (error) {
        outcome = {
          denied: deniedMessage(error),
          reachedDatabase:
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
