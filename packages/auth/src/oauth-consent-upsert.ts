import { randomUUID } from "node:crypto";
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

function readField(data: Record<string, unknown>, camel: string, snake: string): unknown {
  return data[camel] ?? data[snake];
}

function coerceConsentGiven(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "t") return true;
  if (value === 0 || value === "0" || value === "false" || value === "f") return false;
  return false;
}

function parseConsentRecord(data: Record<string, unknown>) {
  const clientId = readField(data, "clientId", "client_id");
  const userId = readField(data, "userId", "user_id");
  const rawId = readField(data, "id", "id");
  const id = typeof rawId === "string" ? rawId : randomUUID();
  const scopes = coerceScopes(readField(data, "scopes", "scopes"));
  const createdAt = coerceDate(readField(data, "createdAt", "created_at"));
  const updatedAt = coerceDate(readField(data, "updatedAt", "updated_at"));
  if (
    typeof clientId !== "string" ||
    typeof userId !== "string" ||
    scopes === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  return {
    id,
    clientId,
    userId,
    scopes,
    consentGiven: coerceConsentGiven(readField(data, "consentGiven", "consent_given")),
    createdAt,
    updatedAt,
  };
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
