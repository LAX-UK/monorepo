import { createHash } from "node:crypto";
import type { EnvelopeCrypto } from "./crypto/envelope.js";

const wrappedSym = Symbol("auction.auth.atRestWrapped");

// biome-ignore lint/suspicious/noExplicitAny: Better Auth adapter methods use heterogeneous per-model args
type AdapterMethod = (...args: any[]) => Promise<any>;

/** Better Auth DB adapter surface we intercept for column encryption. */
type AuthDbAdapter = {
  create: AdapterMethod;
  findOne: AdapterMethod;
  findMany: AdapterMethod;
  update: AdapterMethod;
  updateMany: AdapterMethod;
  delete: AdapterMethod;
  deleteMany: AdapterMethod;
  transaction: (cb: (tx: AuthDbAdapter) => Promise<unknown>) => Promise<unknown>;
  [key: string]: unknown;
};

function isAlreadyWrapped(a: AuthDbAdapter): boolean {
  return Object.getOwnPropertyDescriptor(a, wrappedSym)?.value === true;
}

const ACCOUNT_FIELDS = ["accessToken", "refreshToken", "idToken"] as const;
const TWO_FACTOR_FIELDS = ["secret", "backupCodes"] as const;
const OAUTH_TOKEN_FIELDS = ["accessToken", "refreshToken"] as const;
const TOKEN_HASH_PREFIX = "h1:";

function hashOpaqueToken(value: string): string {
  return `${TOKEN_HASH_PREFIX}${createHash("sha256").update(value).digest("base64url")}`;
}

function isSealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("v1:");
}

function encryptFields(
  model: string,
  data: Record<string, unknown>,
  crypto: EnvelopeCrypto,
): Record<string, unknown> {
  const out = { ...data };
  if (model === "account") {
    for (const f of ACCOUNT_FIELDS) {
      const v = out[f];
      if (typeof v === "string" && v.length > 0 && !isSealed(v)) {
        out[f] = crypto.seal(v);
      }
    }
  } else if (model === "twoFactor") {
    for (const f of TWO_FACTOR_FIELDS) {
      const v = out[f];
      if (typeof v === "string" && v.length > 0 && !isSealed(v)) {
        out[f] = crypto.seal(v);
      }
    }
  } else if (model === "oauthAccessToken") {
    for (const field of OAUTH_TOKEN_FIELDS) {
      const value = out[field];
      if (typeof value === "string" && value.length > 0 && !value.startsWith(TOKEN_HASH_PREFIX)) {
        out[field] = hashOpaqueToken(value);
      }
    }
  }
  return out;
}

function hashOauthTokenWhere(model: string, where: unknown): unknown {
  if (model !== "oauthAccessToken") return where;
  if (Array.isArray(where)) return where.map((entry) => hashOauthTokenWhere(model, entry));
  if (!where || typeof where !== "object") return where;
  const clause = where as Record<string, unknown>;
  const field = clause.field;
  const value = clause.value;
  if (
    (field === "accessToken" || field === "refreshToken") &&
    typeof value === "string" &&
    !value.startsWith(TOKEN_HASH_PREFIX)
  ) {
    return { ...clause, value: hashOpaqueToken(value) };
  }
  return clause;
}

function decryptFields(
  model: string,
  data: Record<string, unknown> | null | undefined,
  crypto: EnvelopeCrypto,
): Record<string, unknown> | null | undefined {
  if (!data) return data;
  const out = { ...data };
  if (model === "account") {
    for (const f of ACCOUNT_FIELDS) {
      const v = out[f];
      if (typeof v === "string" && v.startsWith("v1:")) {
        try {
          out[f] = crypto.open(v);
        } catch (err) {
          // Ciphertext is corrupt or the DEK rotated without a re-encryption pass.
          // Leave the sealed value in place so the row is still readable downstream,
          // but surface the error so it shows up in logs/Sentry rather than silently
          // returning garbage to the caller.
          console.error("[auth:adapter-at-rest] decryption failed", {
            model,
            field: f,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } else if (model === "twoFactor") {
    for (const f of TWO_FACTOR_FIELDS) {
      const v = out[f];
      if (typeof v === "string" && v.startsWith("v1:")) {
        try {
          out[f] = crypto.open(v);
        } catch (err) {
          console.error("[auth:adapter-at-rest] decryption failed", {
            model,
            field: f,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }
  return out;
}

export function wrapAuthDatabaseAdapter(
  base: AuthDbAdapter,
  crypto: EnvelopeCrypto,
): AuthDbAdapter {
  if (isAlreadyWrapped(base)) {
    return base;
  }

  const wrap = (adapter: AuthDbAdapter): AuthDbAdapter => {
    if (isAlreadyWrapped(adapter)) {
      return adapter;
    }
    const out: AuthDbAdapter = {
      ...adapter,
      async create(
        args: { model: string; data: Record<string, unknown> } & Record<string, unknown>,
      ) {
        const rawOauthTokens =
          args.model === "oauthAccessToken"
            ? {
                accessToken: args.data.accessToken,
                refreshToken: args.data.refreshToken,
              }
            : null;
        const next = {
          ...args,
          data: encryptFields(args.model, args.data, crypto),
        };
        const row = (await adapter.create(next)) as Record<string, unknown> | null;
        const decrypted = decryptFields(args.model, row, crypto);
        return decrypted && rawOauthTokens ? { ...decrypted, ...rawOauthTokens } : decrypted;
      },
      async findOne(args: { model: string } & Record<string, unknown>) {
        const row = (await adapter.findOne({
          ...args,
          where: hashOauthTokenWhere(args.model, args.where),
        })) as Record<string, unknown> | null;
        return decryptFields(args.model, row, crypto);
      },
      async findMany(args: { model: string } & Record<string, unknown>) {
        const rows = (await adapter.findMany({
          ...args,
          where: hashOauthTokenWhere(args.model, args.where),
        })) as Record<string, unknown>[] | null;
        if (!Array.isArray(rows)) return rows;
        return rows.map((r) => decryptFields(args.model, r, crypto) as Record<string, unknown>);
      },
      async update(
        args: {
          model: string;
          where: unknown;
          update: Record<string, unknown>;
        } & Record<string, unknown>,
      ) {
        const next = {
          ...args,
          where: hashOauthTokenWhere(args.model, args.where),
          update: encryptFields(args.model, args.update, crypto),
        };
        const row = (await adapter.update(next)) as Record<string, unknown> | null;
        return decryptFields(args.model, row, crypto);
      },
      async updateMany(
        args: {
          model: string;
          where: unknown;
          update: Record<string, unknown>;
        } & Record<string, unknown>,
      ) {
        const next = {
          ...args,
          where: hashOauthTokenWhere(args.model, args.where),
          update: encryptFields(args.model, args.update, crypto),
        };
        return adapter.updateMany(next);
      },
      async delete(args: { model: string; where: unknown } & Record<string, unknown>) {
        return adapter.delete({
          ...args,
          where: hashOauthTokenWhere(args.model, args.where),
        });
      },
      async deleteMany(args: { model: string; where: unknown } & Record<string, unknown>) {
        return adapter.deleteMany({
          ...args,
          where: hashOauthTokenWhere(args.model, args.where),
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
