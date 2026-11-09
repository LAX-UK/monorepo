import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSigningKeyCurrent, verifyIdentityToken } from "./verify-token.js";

const ISSUER = "https://auth.test";
const COOLDOWN_MS = 30_000;

async function newKey(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  return {
    kid,
    privateKey,
    jwk: { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" },
  };
}

type TestKey = Awaited<ReturnType<typeof newKey>>;

function sign(key: TestKey) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
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

describe("isSigningKeyCurrent", () => {
  it("is true for a published key and false once the issuer retires it", async () => {
    const retiring = await newKey("retiring");
    const active = await newKey("active");
    published = [retiring, active];
    const token = await sign(retiring);
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(true);

    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    published = [active];
    expect(await isSigningKeyCurrent({ token, jwksUrl })).toBe(false);
  });

  it("does not refetch more than once per cooldown for a retired kid", async () => {
    const retired = await newKey("retired");
    const active = await newKey("active");
    published = [active];
    const token = await sign(retired);

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
