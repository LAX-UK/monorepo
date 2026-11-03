import { randomBytes } from "node:crypto";
import { createEnvelopeCrypto } from "@auction/identity-contracts";
import {
  type IdentityDatabase,
  createDrizzleJwksStore,
  rotateJwksSigningKey,
} from "@auction/identity-db";
import { jwksKey } from "@auction/identity-db/schema";
import { signJWT } from "better-auth/plugins/jwt";
import { drizzle } from "drizzle-orm/node-postgres";
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify } from "jose";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIdentityJwtSigner } from "./create-identity-jwt-signer.js";

// Needs a throwaway Postgres, e.g.
//   docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
//   DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres pnpm --filter @auction/auth test
// The run works inside its own schema and drops it afterwards.
const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA = `jwks_signing_${randomBytes(4).toString("hex")}`;
const AUTH_SECRET = "rotation-signing-test-secret-0123456789"; // gitleaks:allow
const ISSUER = "https://auth.test.example";
const AUDIENCE = "lax-bid-api";

describe.skipIf(!DATABASE_URL)(
  "a rotated signing key signs tokens the auth service accepts",
  () => {
    let pool: pg.Pool;
    let db: IdentityDatabase;
    const envelope = createEnvelopeCrypto(randomBytes(32));

    beforeAll(async () => {
      const admin = new pg.Client({ connectionString: DATABASE_URL });
      await admin.connect();
      await admin.query(`create schema "${SCHEMA}"`);
      await admin.end();
      pool = new pg.Pool({
        connectionString: DATABASE_URL,
        max: 2,
        options: `-c search_path=${SCHEMA}`,
      });
      await pool.query(`create table jwks_key (
      kid text primary key,
      algorithm text not null default 'RS256',
      public_jwk jsonb not null,
      private_jwk jsonb not null,
      status text not null default 'active',
      created_at timestamptz not null default now(),
      rotated_at timestamptz,
      constraint jwks_key_status_check check (status in ('active','rotating','retired'))
    )`);
      db = drizzle(pool, { schema: { jwksKey } }) as unknown as IdentityDatabase;
    });

    afterAll(async () => {
      await pool?.end();
      const admin = new pg.Client({ connectionString: DATABASE_URL });
      await admin.connect();
      await admin.query(`drop schema if exists "${SCHEMA}" cascade`);
      await admin.end();
    });

    it("is decrypted by Better Auth's own signer and verifies against the published JWKS", async () => {
      // The key exactly as scripts/rotate-jwks.ts generates it: raw JWK JSON.
      const pair = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
      const result = await rotateJwksSigningKey(db, {
        key: {
          publicKey: JSON.stringify(await exportJWK(pair.publicKey)),
          privateKey: JSON.stringify(await exportJWK(pair.privateKey)),
          alg: "RS256",
        },
        authSecret: AUTH_SECRET,
        envelope,
      });
      const store = createDrizzleJwksStore(db, envelope);

      // Better Auth's jwt plugin signing path, configured as in packages/auth.
      const token = await signJWT(
        {
          context: {
            secretConfig: AUTH_SECRET,
            options: { baseURL: ISSUER },
            adapter: {},
          },
        } as never,
        {
          options: {
            jwks: { keyPairConfig: { alg: "RS256", modulusLength: 2048 } },
            jwt: { issuer: ISSUER, audience: AUDIENCE },
            adapter: { getJwks: () => store.getJwks(), createJwk: (data) => store.createJwk(data) },
          },
          payload: { sub: "subject-1" },
        },
      );

      const published = createLocalJWKSet(await store.getPublicJwks());
      const verified = await jwtVerify(token, published, { issuer: ISSUER, audience: AUDIENCE });
      expect(verified.protectedHeader.kid).toBe(result.newKid);
      expect(verified.payload.sub).toBe("subject-1");
    });

    it("is also accepted by the auth service's identity signer", async () => {
      const store = createDrizzleJwksStore(db, envelope);
      const signer = createIdentityJwtSigner({ jwks: store, authSecret: AUTH_SECRET });
      const { token, kid } = await signer.sign({
        typ: "JWT",
        issuer: ISSUER,
        audience: AUDIENCE,
        subject: "subject-2",
        expirationTime: "5m",
        claims: {},
      });
      const published = createLocalJWKSet(await store.getPublicJwks());
      const verified = await jwtVerify(token, published, { issuer: ISSUER, audience: AUDIENCE });
      expect(verified.protectedHeader.kid).toBe(kid);
    });
  },
);
