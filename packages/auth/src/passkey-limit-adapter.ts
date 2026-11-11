import { APIError } from "better-auth/api";
import { PASSKEY_LIMIT_ERROR_CODE } from "./passkey-error-codes.js";

// biome-ignore lint/suspicious/noExplicitAny: Better Auth adapter methods use heterogeneous per-model args
type AdapterMethod = (...args: any[]) => Promise<any>;

type AuthDbAdapter = {
  create: AdapterMethod;
  transaction: (cb: (tx: AuthDbAdapter) => Promise<unknown>) => Promise<unknown>;
  [key: string]: unknown;
};

export { PASSKEY_LIMIT_ERROR_CODE };

/** The one SQLSTATE the database raises when a person already holds the most passkeys. */
const CHECK_VIOLATION = "23514";

const wrappedSym = Symbol("auction.auth.passkeyLimitWrapped");

type PgLikeError = { code?: unknown; message?: unknown; cause?: unknown };

/** Whether `error` (or the error under it) is the database refusing an extra passkey. */
export function isPasskeyLimitError(error: unknown): boolean {
  let current: unknown = error;
  // Drivers and ORMs wrap the original error, so look through a few layers for the SQLSTATE.
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as PgLikeError;
    if (
      candidate.code === CHECK_VIOLATION &&
      typeof candidate.message === "string" &&
      candidate.message.includes(PASSKEY_LIMIT_ERROR_CODE)
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

/**
 * The database caps a person at ten passkeys with a trigger, so no code path can pass the limit
 * (SQLSTATE 23514, message `passkey_limit`). Better Auth's passkey endpoint would turn that into
 * a generic failure, so the refusal is named here, where the insert is made: the person is told
 * they have the most an account can hold, not that something broke.
 */
export function wrapPasskeyLimitAdapter(base: AuthDbAdapter): AuthDbAdapter {
  const wrap = (adapter: AuthDbAdapter): AuthDbAdapter => {
    if (Object.getOwnPropertyDescriptor(adapter, wrappedSym)?.value === true) return adapter;
    const out: AuthDbAdapter = {
      ...adapter,
      async create(args: { model: string } & Record<string, unknown>) {
        try {
          return await adapter.create(args);
        } catch (error) {
          if (args.model === "passkey" && isPasskeyLimitError(error)) {
            throw new APIError("UNPROCESSABLE_ENTITY", {
              message: "You have the most passkeys an account can have.",
              code: PASSKEY_LIMIT_ERROR_CODE,
            });
          }
          throw error;
        }
      },
      async transaction(cb: (tx: AuthDbAdapter) => Promise<unknown>) {
        return adapter.transaction(async (tx) => cb(wrap(tx as AuthDbAdapter)));
      },
    };
    Object.defineProperty(out, wrappedSym, { value: true, enumerable: false });
    return out;
  };
  return wrap(base);
}
