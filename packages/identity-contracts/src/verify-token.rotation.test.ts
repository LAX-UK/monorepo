import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSigningKeyCurrent, verifyIdentityToken } from "./verify-token.js";

const ISSUER = "https://auth.test";
const COOLDOWN_MS = 30_000;
const REFRESH_MS = 60_000;
const MAX_STALE_MS = 10 * 60_000;
const START = new Date("2026-06-01T00:00:00.500Z");

async function newKey(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  return {
    kid,
    privateKey,
    jwk: { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" },
  };
}

type TestKey = Awaited<ReturnType<typeof newKey>>;

function sign(key: TestKey, issuedAt?: Date) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setIssuedAt(issuedAt)
    .setSubject("user-1")
    .setIssuer(ISSUER)
    .setAudience("lax-bid-api")
    .setExpirationTime("5m")
    .sign(key.privateKey);
}

let published: TestKey[];
let fetches: number;
let urlSeq = 0;
let jwksUrl: string;

beforeEach(() => {
  published = [];
  fetches = 0;
  // The verifier caches key sets per URL, so every test gets its own.
  jwksUrl = `${ISSUER}/${urlSeq++}/.well-known/jwks.json`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      fetches++;
      return new Response(JSON.stringify({ keys: published.map((k) => k.jwk) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("JWKS refetch on key rotation", () => {
  it("refetches once for an unknown kid, then verifies the token", async () => {
    const oldKey = await newKey("old");
    const newerKey = await newKey("new");
    published = [oldKey];
    expect(
      await verifyIdentityToken({ token: await sign(oldKey), jwksUrl, issuer: ISSUER }),
    ).not.toBeNull();
    expect(fetches).toBe(1);

    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    published = [oldKey, newerKey];
    const verified = await verifyIdentityToken({
      token: await sign(newerKey),
      jwksUrl,
      issuer: ISSUER,
    });

    expect(verified?.subject).toBe("user-1");
    expect(fetches).toBe(2);
  });

  it("fails closed when the kid is still unknown after the refetch", async () => {
    const known = await newKey("known");
    const stranger = await newKey("stranger");
    published = [known];
    await verifyIdentityToken({ token: await sign(known), jwksUrl, issuer: ISSUER });

    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    const result = await verifyIdentityToken({
      token: await sign(stranger),
      jwksUrl,
      issuer: ISSUER,
    });

    expect(result).toBeNull();
    expect(fetches).toBe(2);
  });

  it("rate-limits refetches to one per cooldown", async () => {
    const known = await newKey("known");
    const stranger = await newKey("stranger");
    published = [known];
    await verifyIdentityToken({ token: await sign(known), jwksUrl, issuer: ISSUER });
    const token = await sign(stranger);

    for (let i = 0; i < 5; i++) {
      expect(await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })).toBeNull();
    }
    expect(fetches).toBe(1);

    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    expect(await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })).toBeNull();
    expect(fetches).toBe(2);
  });
});

describe("JWKS holder under load and outage", () => {
  it("fetches exactly once for parallel verifies of an unknown kid", async () => {
    const known = await newKey("known");
    const newer = await newKey("newer");
    published = [known];
    await verifyIdentityToken({ token: await sign(known), jwksUrl, issuer: ISSUER });
    expect(fetches).toBe(1);

    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    published = [known, newer];
    const token = await sign(newer);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })),
    );

    expect(results.every((r) => r?.subject === "user-1")).toBe(true);
    expect(fetches).toBe(2);
  });

  it("serves the last good set through an issuer outage, with bounded fetches, then fails closed", async () => {
    const known = await newKey("known");
    const stranger = await newKey("stranger");
    published = [known];
    const token = await sign(known);
    expect(await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })).not.toBeNull();
    expect(fetches).toBe(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        fetches++;
        return new Response("down", { status: 503 });
      }),
    );

    // Two minutes of outage, with a request every few seconds: every one is served from the last
    // good set, and the failing issuer is hit only once per failure cooldown.
    const outageStart = Date.now();
    for (let elapsed = REFRESH_MS + 1; elapsed <= 2 * REFRESH_MS; elapsed += 5_000) {
      vi.setSystemTime(outageStart + elapsed);
      expect(await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })).not.toBeNull();
    }
    const fetchesInTwoMinutes = fetches - 1;
    expect(fetchesInTwoMinutes).toBeLessThanOrEqual(Math.ceil(REFRESH_MS / COOLDOWN_MS) + 1);

    // A key the issuer never published is not added by a failed fetch.
    expect(
      await verifyIdentityToken({ token: await sign(stranger), jwksUrl, issuer: ISSUER }),
    ).toBeNull();

    // Past the maximum staleness the set is dropped and verification fails closed.
    vi.setSystemTime(outageStart + MAX_STALE_MS + 1_000);
    expect(await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })).toBeNull();
  });

  it("recovers on the first fetch after the issuer comes back", async () => {
    const known = await newKey("known");
    published = [known];
    const token = await sign(known);
    await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER });

    const working = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    vi.setSystemTime(Date.now() + REFRESH_MS + 1);
    expect(await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })).not.toBeNull();

    vi.stubGlobal("fetch", working);
    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    const before = fetches;
    expect(await verifyIdentityToken({ token, jwksUrl, issuer: ISSUER })).not.toBeNull();
    expect(fetches).toBe(before + 1);
  });
});

describe("isSigningKeyCurrent clock margin", () => {
  it("keeps a token issued within five seconds before the fetch, and drops one issued earlier", async () => {
    const active = await newKey("active");
    const other = await newKey("other");
    published = [active];
    const justBefore = await sign(other, new Date(START.getTime() - 2_000));
    expect(await isSigningKeyCurrent({ token: justBefore, jwksUrl })).toBe(true);

    const earlier = await sign(other, new Date(START.getTime() - 10_000));
    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    expect(await isSigningKeyCurrent({ token: earlier, jwksUrl })).toBe(false);
  });
});

describe("isSigningKeyCurrent with a newer key", () => {
  it("keeps a token signed by a key published after the last fetch, without refetching again", async () => {
    const old = await newKey("old");
    const newer = await newKey("newer");
    published = [old];
    await verifyIdentityToken({ token: await sign(old), jwksUrl, issuer: ISSUER });
    expect(fetches).toBe(1);

    // The issuer rotates; the token is newer than our last fetch, and the refetch is still
    // rate-limited, so the key cannot be judged retired.
    vi.setSystemTime(Date.now() + 10_000);
    published = [old, newer];
    const token = await sign(newer);
    for (let i = 0; i < 5; i++) expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(true);
    expect(fetches).toBe(1);

    // Once the refetch is allowed, the new key is found.
    vi.setSystemTime(Date.now() + COOLDOWN_MS);
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(true);
    expect(fetches).toBe(2);
  });
});

describe("isSigningKeyCurrent", () => {
  it("is true for a published key and false once the issuer retires it", async () => {
    const retiring = await newKey("retiring");
    const active = await newKey("active");
    published = [retiring, active];
    const token = await sign(retiring);
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(true);

    // The retired key still verifies until the next scheduled refresh, then it is gone.
    published = [active];
    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(true);
    // After the refresh interval the old set is still served while a refresh runs behind the
    // request; the next check sees the new set.
    vi.setSystemTime(Date.now() + REFRESH_MS);
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(false);
  });

  it("does not refetch more than once per cooldown for a retired kid", async () => {
    const retired = await newKey("retired");
    const active = await newKey("active");
    published = [active];
    // Issued well before the key set was fetched, so the key cannot be one we have yet to see.
    const token = await sign(retired, new Date(START.getTime() - 60_000));

    for (let i = 0; i < 4; i++) expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(false);
    expect(fetches).toBe(1);
  });

  it("rejects tokens without a usable header", async () => {
    expect(await isSigningKeyCurrent({ token: "not-a-jwt", jwksUrl })).toBe(false);
    expect(fetches).toBe(0);
  });

  it("keeps the token when the key set is unreachable", async () => {
    const key = await newKey("k");
    const token = await sign(key);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(true);
  });
});
