import { type Database, jwksKey } from "@auction/db";
import type { Jwk } from "better-auth/plugins/jwt";
import { eq, inArray } from "drizzle-orm";

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

export function createJwksAdapter(db: Database) {
  return {
    async getJwks(): Promise<Jwk[]> {
      const rows = await db
        .select()
        .from(jwksKey)
        .where(inArray(jwksKey.status, ["active", "rotating"]));

      return rows.map((row) => ({
        id: row.kid,
        publicKey: parseKey(row.publicJwk),
        privateKey: parseKey(row.privateJwk),
        createdAt: row.createdAt,
        alg: row.algorithm as Jwk["alg"],
      }));
    },
    async createJwk(data: Omit<Jwk, "id">): Promise<Jwk> {
      const kid = crypto.randomUUID();
      const [row] = await db
        .insert(jwksKey)
        .values({
          kid,
          algorithm: data.alg ?? "RS256",
          publicJwk: toStoredJwk(data.publicKey),
          privateJwk: toStoredJwk(data.privateKey),
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
