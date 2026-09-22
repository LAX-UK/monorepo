import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTokenCipher } from "../infrastructure/token-crypto.js";
import { createPgSessionTokenStore } from "./shop-session-token.repository.js";

const shopUrl = process.env.DATABASE_URL_SHOP;
const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe.skipIf(!shopUrl)("pg session token store", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    if (!shopUrl) throw new Error("DATABASE_URL_SHOP is required");
    pool = new pg.Pool({ connectionString: shopUrl });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function insertSession(): Promise<string> {
    const id = randomBytes(32).toString("base64url");
    await pool.query(
      `insert into shop_identity_session (id, subject_id, expires_at, created_at, updated_at)
       values ($1, $2, now() + interval '1 day', now(), now())`,
      [id, `integration-subject-${Date.now()}`],
    );
    return id;
  }

  it("round-trips encrypted tokens and clears them", async () => {
    const store = createPgSessionTokenStore(pool, createTokenCipher(encryptionKey));
    const sessionId = await insertSession();
    const tokens = {
      idToken: "header.payload.signature",
      refreshToken: "refresh-value",
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    await store.save(sessionId, tokens);
    await expect(store.read(sessionId)).resolves.toEqual(tokens);
    await expect(store.hasStoredRefreshToken(sessionId)).resolves.toBe(true);
    await store.clear(sessionId);
    await expect(store.read(sessionId)).resolves.toBeNull();
    await expect(store.hasStoredRefreshToken(sessionId)).resolves.toBe(false);
  });

  it("serializes concurrent withLock callers for one session", async () => {
    const store = createPgSessionTokenStore(pool, createTokenCipher(encryptionKey));
    const sessionId = await insertSession();
    await store.save(sessionId, {
      idToken: "stale-id-token",
      refreshToken: "refresh-a",
      refreshExpiresAt: null,
    });
    let refreshCalls = 0;
    const runRefresh = async (): Promise<string> => {
      return store.withLock(sessionId, async ({ current, save }) => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        const next = {
          idToken: `rotated-${refreshCalls}`,
          refreshToken: current?.refreshToken ?? "refresh-a",
          refreshExpiresAt: null,
        };
        await save(next);
        return next.idToken;
      });
    };
    const [first, second] = await Promise.all([runRefresh(), runRefresh()]);
    expect(refreshCalls).toBe(2);
    expect(second).toBe("rotated-2");
    expect(first).toBe("rotated-1");
    await expect(store.read(sessionId)).resolves.toMatchObject({ idToken: "rotated-2" });
  });
});
