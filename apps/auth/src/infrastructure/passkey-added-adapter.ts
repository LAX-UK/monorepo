import { randomUUID } from "node:crypto";
import type { IdentityEventPublisher } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { passkey } from "@auction/identity-db/schema";

// biome-ignore lint/suspicious/noExplicitAny: Better Auth adapter methods use heterogeneous per-model args
type AdapterMethod = (...args: any[]) => Promise<any>;

type AuthDbAdapter = {
  create: AdapterMethod;
  transaction: (cb: (tx: AuthDbAdapter) => Promise<unknown>) => Promise<unknown>;
  [key: string]: unknown;
};

const wrappedSym = Symbol("auction.auth.passkeyAddedWrapped");

type PasskeyData = {
  name?: string | null;
  userId: string;
  credentialID: string;
  publicKey: string;
  counter: number;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports?: string | null;
  aaguid?: string | null;
  createdAt?: Date;
};

/**
 * Stores a new passkey and its "added" audit event in one transaction. Better Auth's own insert
 * would store the passkey alone, and an event published afterwards could be lost between the two;
 * here the event is in the same commit as the passkey, so a passkey is never without its trail.
 *
 * The database's ten-passkey trigger still decides: its refusal rolls the whole transaction back,
 * and is named by `wrapPasskeyLimitAdapter` above this one. Any other model goes through untouched.
 */
export function wrapPasskeyAddedAdapter(
  base: AuthDbAdapter,
  deps: { db: IdentityDatabase; events: IdentityEventPublisher },
): AuthDbAdapter {
  const wrap = (adapter: AuthDbAdapter): AuthDbAdapter => {
    if (Object.getOwnPropertyDescriptor(adapter, wrappedSym)?.value === true) return adapter;
    const out: AuthDbAdapter = {
      ...adapter,
      async create(args: { model: string; data: PasskeyData } & Record<string, unknown>) {
        if (args.model !== "passkey") return adapter.create(args);
        const data = args.data;
        return deps.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(passkey)
            .values({
              id: randomUUID(),
              userId: data.userId,
              name: data.name ?? null,
              publicKey: data.publicKey,
              credentialId: data.credentialID,
              counter: data.counter,
              deviceType: data.deviceType,
              backedUp: data.backedUp,
              transports: data.transports ?? null,
              aaguid: data.aaguid ?? null,
              ...(data.createdAt ? { createdAt: data.createdAt } : {}),
            })
            .returning();
          if (!row) throw new Error("passkey_not_stored");
          await deps.events.publish(
            { type: "user.sign_in_method_added", userId: data.userId, method: "passkey" },
            { transaction: tx as never },
          );
          // In the plugin's own field names, which is what it returns to the caller.
          return {
            id: row.id,
            name: row.name,
            publicKey: row.publicKey,
            userId: row.userId,
            credentialID: row.credentialId,
            counter: row.counter,
            deviceType: row.deviceType,
            backedUp: row.backedUp,
            transports: row.transports,
            createdAt: row.createdAt,
            aaguid: row.aaguid,
          };
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
