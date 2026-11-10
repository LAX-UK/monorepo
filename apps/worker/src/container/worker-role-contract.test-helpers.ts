import type { WorkerDb } from "../workers/types.js";

/** An id that matches no row, valid as both a uuid and a text key. */
export const NIL = "00000000-0000-0000-0000-000000000000";

const PERMISSION_DENIED = "42501";

class RolledBack extends Error {}

export type ProbeOutcome = {
  /** PostgreSQL's message when the call was denied, otherwise null. */
  denied: string | null;
  /** True when PostgreSQL answered (rows or an error), false when the call failed before that. */
  reachedDatabase: boolean;
};

function postgresCode(error: unknown): string | undefined {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    const { code } = cause as { code?: unknown };
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
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
): Promise<ProbeOutcome> {
  let outcome: ProbeOutcome = { denied: null, reachedDatabase: false };
  try {
    await db.transaction(async (tx) => {
      try {
        await call(tx as unknown as WorkerDb);
        outcome = { denied: null, reachedDatabase: true };
      } catch (error) {
        outcome = {
          denied: deniedMessage(error),
          reachedDatabase: postgresCode(error) !== undefined,
        };
      }
      throw new RolledBack();
    });
  } catch (error) {
    if (!(error instanceof RolledBack)) throw error;
  }
  return outcome;
}
