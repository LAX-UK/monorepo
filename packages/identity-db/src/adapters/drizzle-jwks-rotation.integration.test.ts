import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createEnvelopeCrypto } from "@auction/identity-contracts";
import { ACCESS_TOKEN_TTL_SECONDS } from "@auction/identity-contracts";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../schema/index.js";
import { jwksKey } from "../schema/jwks-key.js";
import type { IdentityDatabase } from "./drizzle-consent-store.js";
import { JWKS_RETIREMENT_WINDOW_MS, retireExpiredJwksKeys } from "./drizzle-jwks-retirement.js";
import { rotateJwksSigningKey } from "./drizzle-jwks-rotation.js";
import { createDrizzleJwksStore } from "./drizzle-jwks-store.js";

// Needs a throwaway Postgres, e.g.
//   docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
//   DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres pnpm --filter @auction/identity-db test
// Every run works inside its own schema and drops it afterwards.
const DATABASE_URL = process.env.DATABASE_URL;
const SCHEMA = `jwks_rotation_${randomBytes(4).toString("hex")}`;

function newKey() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    publicKey: JSON.stringify(publicKey.export({ format: "jwk" })),
    privateKey: JSON.stringify(privateKey.export({ format: "jwk" })),
    alg: "RS256" as const,
  };
}

async function seedActive(db: IdentityDatabase, kid: string, createdAt: Date) {
  await db.insert(jwksKey).values({
    kid,
    publicJwk: { kty: "RSA", kid },
    privateJwk: { kty: "RSA", kid },
    status: "active",
    createdAt,
  });
}

describe.skipIf(!DATABASE_URL)("JWKS rotation against Postgres", () => {
  let pool: pg.Pool;
  let db: IdentityDatabase;
  const envelope = createEnvelopeCrypto(randomBytes(32));

  beforeAll(async () => {
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 4,
      options: `-c search_path=${SCHEMA}`,
    });
    const admin = new pg.Client({ connectionString: DATABASE_URL });
    await admin.connect();
    await admin.query(`create schema "${SCHEMA}"`);
    await admin.end();
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
    db = drizzle(pool, { schema });
  });

  beforeEach(async () => {
    await pool.query("delete from jwks_key");
  });

  afterAll(async () => {
    await pool?.end();
    const admin = new pg.Client({ connectionString: DATABASE_URL });
    await admin.connect();
    await admin.query(`drop schema if exists "${SCHEMA}" cascade`);
    await admin.end();
  });

  it("makes the new key active and the old key rotating, both published", async () => {
    const now = new Date("2026-11-03T10:00:00.000Z");
    await seedActive(db, "old", new Date("2026-08-01T00:00:00.000Z"));

    const result = await rotateJwksSigningKey(db, { key: newKey(), envelope, now });

    expect(result.rotatedKids).toEqual(["old"]);
    const rows = await db.select().from(jwksKey);
    const byKid = new Map(rows.map((row) => [row.kid, row]));
    expect(byKid.get("old")).toMatchObject({ status: "rotating", rotatedAt: now });
    expect(byKid.get(result.newKid)).toMatchObject({ status: "active", rotatedAt: null });

    const store = createDrizzleJwksStore(db, envelope);
    const published = await store.getPublicJwks();
    expect(published.keys.map((key) => key.kid).sort()).toEqual([result.newKid, "old"].sort());
    expect((await store.getActiveSigningJwk())?.id).toBe(result.newKid);
  });

  it("seals the new private key with the envelope", async () => {
    const result = await rotateJwksSigningKey(db, { key: newKey(), envelope });
    const { rows } = await pool.query("select private_jwk from jwks_key where kid = $1", [
      result.newKid,
    ]);
    expect(String(rows[0].private_jwk)).toMatch(/^v1:/);
    const signing = await createDrizzleJwksStore(db, envelope).getActiveSigningJwk();
    expect(JSON.parse(signing?.privateKey ?? "{}")).toMatchObject({ kty: "RSA" });
  });

  it("works on an empty table", async () => {
    const result = await rotateJwksSigningKey(db, { key: newKey(), envelope });
    expect(result.rotatedKids).toEqual([]);
    expect(await db.select().from(jwksKey)).toHaveLength(1);
  });

  it("leaves the previous state untouched when the insert fails", async () => {
    await seedActive(db, "old", new Date("2026-08-01T00:00:00.000Z"));
    await expect(
      rotateJwksSigningKey(db, {
        key: { ...newKey(), publicKey: "not json", alg: "RS256" },
        envelope: {
          seal: () => {
            throw new Error("seal failed");
          },
          open: (value) => value,
        },
      }),
    ).rejects.toThrow("seal failed");
    const [row] = await db.select().from(jwksKey);
    expect(row).toMatchObject({ kid: "old", status: "active", rotatedAt: null });
  });

  it("retires the rotating key only after the token lifetime has passed", async () => {
    const now = new Date("2026-11-03T10:00:00.000Z");
    await seedActive(db, "old", new Date("2026-08-01T00:00:00.000Z"));
    await rotateJwksSigningKey(db, { key: newKey(), envelope, now });

    expect(JWKS_RETIREMENT_WINDOW_MS).toBeGreaterThan(ACCESS_TOKEN_TTL_SECONDS * 1000);

    const justBefore = new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    await retireExpiredJwksKeys(db, justBefore);
    expect((await db.select().from(jwksKey)).find((r) => r.kid === "old")?.status).toBe("rotating");

    const afterWindow = new Date(now.getTime() + JWKS_RETIREMENT_WINDOW_MS + 1000);
    await retireExpiredJwksKeys(db, afterWindow);
    const rows = await db.select().from(jwksKey);
    expect(rows.find((r) => r.kid === "old")?.status).toBe("retired");
    expect(rows.filter((r) => r.status === "active")).toHaveLength(1);

    const published = await createDrizzleJwksStore(db, envelope).getPublicJwks();
    expect(published.keys).toHaveLength(1);
  });

  describe("rotate-jwks script", () => {
    const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
    const run = (args: string[]) => {
      const url = new URL(String(DATABASE_URL));
      url.searchParams.set("options", `-c search_path=${SCHEMA}`);
      return execFileSync("pnpm", ["exec", "tsx", "scripts/rotate-jwks.ts", ...args], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL_OWNER: url.toString(),
          AUTH_DEK_KEY: randomBytes(32).toString("hex"),
        },
      });
    };

    it("does not touch the database on --dry-run", async () => {
      await seedActive(db, "old", new Date("2026-08-01T00:00:00.000Z"));
      expect(run(["--dry-run"])).toContain("Dry run");
      const rows = await db.select().from(jwksKey);
      expect(rows.map((row) => [row.kid, row.status])).toEqual([["old", "active"]]);
    });

    it("rotates the key and reports the new kid", async () => {
      await seedActive(db, "old", new Date("2026-08-01T00:00:00.000Z"));
      const output = run([]);
      expect(output).toContain("Now rotating: old");
      const rows = await db.select().from(jwksKey);
      expect(rows.find((row) => row.kid === "old")).toMatchObject({ status: "rotating" });
      expect(rows.find((row) => row.kid === "old")?.rotatedAt).toBeInstanceOf(Date);
      expect(rows.filter((row) => row.status === "active")).toHaveLength(1);
    });
  });
});
