import { signUpLegalAcceptance } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { getCurrentAuthContext } from "@better-auth/core/context";
import { getOAuthState } from "better-auth/api";
import { DrizzleLegalAcceptanceRecorder } from "./drizzle-legal-acceptance.recorder.js";

// biome-ignore lint/suspicious/noExplicitAny: Better Auth adapter methods use heterogeneous per-model args
type AdapterMethod = (...args: any[]) => Promise<any>;

type AuthDbAdapter = {
  create: AdapterMethod;
  transaction: (cb: (tx: AuthDbAdapter) => Promise<unknown>) => Promise<unknown>;
  [key: string]: unknown;
};

/** Builds the Better Auth adapter over a Drizzle executor (the database, or one transaction). */
export type AdapterOnExecutor = (executor: IdentityDatabase) => AuthDbAdapter;

const wrappedSym = Symbol("auction.auth.userLegalAcceptanceWrapped");

/**
 * Stores a new user row and the record of the Terms and Privacy notice its owner was shown in one
 * database transaction: both commit, or neither does. Better Auth runs `user.create.after` hooks
 * only once the insert has committed, so a record written there could fail on its own and leave an
 * account that has no record.
 *
 * Every way an account is created (email sign-up, Google or Apple sign-in, magic link, passkey
 * enrolment) goes through Better Auth's `user` insert, so this one place covers them all. A sign-up
 * that carries no statement from the hosted pages claims none and is stored as before; a record that
 * is due and cannot be written rolls the user row back, and the sign-up fails.
 */
export function wrapUserLegalAcceptanceAdapter(
  base: AuthDbAdapter,
  deps: {
    db: IdentityDatabase;
    adapterOn: AdapterOnExecutor;
    now?: () => Date;
  },
): AuthDbAdapter {
  const wrap = (adapter: AuthDbAdapter): AuthDbAdapter => {
    if (Object.getOwnPropertyDescriptor(adapter, wrappedSym)?.value === true) return adapter;
    const out: AuthDbAdapter = {
      ...adapter,
      async create(args: { model: string; data: { id?: string } } & Record<string, unknown>) {
        if (args.model !== "user") return adapter.create(args);
        const context = await getCurrentAuthContext().catch(() => null);
        const oauthState = await getOAuthState().catch(() => null);
        // Decided before the insert; the subject is filled in from the row the insert returns.
        const due = signUpLegalAcceptance("", context, oauthState);
        if (!due) return adapter.create(args);
        return deps.db.transaction(async (tx) => {
          const created = await deps.adapterOn(tx as unknown as IdentityDatabase).create(args);
          if (!created?.id) throw new Error("user_not_stored");
          await new DrizzleLegalAcceptanceRecorder(
            tx as unknown as IdentityDatabase,
            deps.now,
          ).recordSignUp({
            ...due,
            subjectId: created.id as string,
          });
          return created;
        });
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
