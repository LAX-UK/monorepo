import type { ConsentStore } from "./ports/consent-store.js";

// biome-ignore lint/suspicious/noExplicitAny: Better Auth adapter methods use heterogeneous per-model args
type AdapterMethod = (...args: any[]) => Promise<any>;

type AuthDbAdapter = {
  create: AdapterMethod;
  transaction: (cb: (tx: AuthDbAdapter) => Promise<unknown>) => Promise<unknown>;
  [key: string]: unknown;
};

const wrappedSym = Symbol("auction.auth.oauthConsentUpsertWrapped");

function isAlreadyWrapped(adapter: AuthDbAdapter): boolean {
  return Object.getOwnPropertyDescriptor(adapter, wrappedSym)?.value === true;
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function coerceScopes(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((scope) => typeof scope === "string")) {
    return value.join(" ");
  }
  return null;
}

function parseConsentRecord(data: Record<string, unknown>) {
  const clientId = data.clientId;
  const userId = data.userId;
  const scopes = coerceScopes(data.scopes);
  const consentGiven = data.consentGiven;
  const id = data.id;
  const createdAt = coerceDate(data.createdAt);
  const updatedAt = coerceDate(data.updatedAt);
  if (
    typeof clientId !== "string" ||
    typeof userId !== "string" ||
    scopes === null ||
    typeof consentGiven !== "boolean" ||
    typeof id !== "string" ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  return { id, clientId, userId, scopes, consentGiven, createdAt, updatedAt };
}

/** Routes Better Auth oauthConsent inserts through the atomic ConsentStore port. */
export function wrapOAuthConsentUpsertAdapter(
  base: AuthDbAdapter,
  consentStore: ConsentStore,
): AuthDbAdapter {
  if (isAlreadyWrapped(base)) {
    return base;
  }

  const wrap = (adapter: AuthDbAdapter, store: ConsentStore): AuthDbAdapter => {
    if (isAlreadyWrapped(adapter)) {
      return adapter;
    }

    const out: AuthDbAdapter = {
      ...adapter,
      async create(
        args: { model: string; data: Record<string, unknown> } & Record<string, unknown>,
      ) {
        if (args.model !== "oauthConsent") {
          return adapter.create(args);
        }
        const record = parseConsentRecord(args.data);
        if (!record) {
          return adapter.create(args);
        }
        return store.upsert(record);
      },
      async transaction(cb: (tx: AuthDbAdapter) => Promise<unknown>) {
        return adapter.transaction(async (tx) => cb(wrap(tx as AuthDbAdapter, store)));
      },
    };

    Object.defineProperty(out, wrappedSym, { value: true, enumerable: false });
    return out;
  };

  return wrap(base, consentStore);
}
