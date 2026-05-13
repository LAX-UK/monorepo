import { type Database, jwksKey } from "@auction/db";
import type { Jwk } from "better-auth/plugins/jwt";
import { eq, inArray } from "drizzle-orm";
import type { EnvelopeCrypto } from "./crypto/envelope.js";

type StoredJwk = {
  kid?: string;
  alg?: string;
  kty?: string;
  use?: string;
  [key: string]: unknown;
};

function parseKey(value: unknown): string {
  return JSON.stringify(value);
}

function toStoredJwk(value: string): StoredJwk | string {
  try {
    return JSON.parse(value) as StoredJwk;
  } catch {
    return value;
  }
}

function privatePayloadToSignInput(payload: unknown, envelope?: EnvelopeCrypto): string {
  if (envelope && typeof payload === "string" && payload.startsWith("v1:")) {
    return envelope.open(payload);
  }
  return parseKey(payload);
}

function sealPrivateForDb(data: Omit<Jwk, "id">, envelope?: EnvelopeCrypto): unknown {
  const raw = typeof data.privateKey === "string" ? data.privateKey : parseKey(data.privateKey);
  if (!envelope) return toStoredJwk(data.privateKey);
  return envelope.seal(raw);
}

export function createJwksAdapter(db: Database, envelope?: EnvelopeCrypto) {
  return {
    async getJwks(): Promise<Jwk[]> {
      const rows = await db
        .select()
        .from(jwksKey)
        .where(inArray(jwksKey.status, ["active", "rotating"]));

      return rows.map((row) => ({
        id: row.kid,
        publicKey: parseKey(row.publicJwk),
        privateKey: privatePayloadToSignInput(row.privateJwk, envelope),
        createdAt: row.createdAt,
        alg: row.algorithm as Jwk["alg"],
      }));
    },
    async createJwk(data: Omit<Jwk, "id">): Promise<Jwk> {
      const kid = crypto.randomUUID();
      const privateForDb = sealPrivateForDb(data, envelope);
      const [row] = await db
        .insert(jwksKey)
        .values({
          kid,
          algorithm: data.alg ?? "RS256",
          publicJwk: toStoredJwk(data.publicKey),
          privateJwk: privateForDb as never,
          status: "active",
          createdAt: data.createdAt,
          rotatedAt: data.expiresAt ?? null,
        })
        .onConflictDoNothing()
        .returning();

      const jwk: Jwk = {
        id: row?.kid ?? kid,
        publicKey: data.publicKey,
        privateKey: data.privateKey,
        createdAt: data.createdAt,
      };
      if (data.expiresAt) jwk.expiresAt = data.expiresAt;
      if (data.alg) jwk.alg = data.alg;
      if (data.crv) jwk.crv = data.crv;
      return jwk;
    },
    async getPublicJwks() {
      const rows = await db
        .select({
          kid: jwksKey.kid,
          algorithm: jwksKey.algorithm,
          publicJwk: jwksKey.publicJwk,
        })
        .from(jwksKey)
        .where(inArray(jwksKey.status, ["active", "rotating"]));

      return {
        keys: rows.map((row) => {
          const key =
            typeof row.publicJwk === "object" && row.publicJwk
              ? (row.publicJwk as StoredJwk)
              : (JSON.parse(String(row.publicJwk)) as StoredJwk);
          return {
            ...key,
            kid: key.kid ?? row.kid,
            alg: key.alg ?? row.algorithm,
            use: key.use ?? "sig",
          };
        }),
      };
    },
    async markKeyRetired(kid: string): Promise<void> {
      await db.update(jwksKey).set({ status: "retired" }).where(eq(jwksKey.kid, kid));
    },
  };
}
