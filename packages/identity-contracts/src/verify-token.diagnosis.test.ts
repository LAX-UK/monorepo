import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  diagnoseTokenRejection,
  isExpiredWithValidSignature,
  signingKeyStatus,
  verifyIdentityToken,
} from "./verify-token.js";

const ISSUER = "https://auth.test";
const AUDIENCE = "lax-bid-api";
const COOLDOWN_MS = 30_000;
const STALE_KEY_SET_MS = 2 * 60_000;
const START = new Date("2026-06-01T00:00:00.000Z");
const startSeconds = Math.floor(START.getTime() / 1000);

async function newKey(kid: string) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  return {
    kid,
    privateKey,
    jwk: { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" },
  };
}

type TestKey = Awaited<ReturnType<typeof newKey>>;

function sign(
  key: TestKey,
  claims: { issuedAt?: number; expiresAt?: number; audience?: string } = {},
) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: key.kid })
    .setIssuedAt(claims.issuedAt ?? startSeconds)
    .setSubject("user-1")
    .setIssuer(ISSUER)
    .setAudience(claims.audience ?? AUDIENCE)
    .setExpirationTime(claims.expiresAt ?? startSeconds + 300)
    .sign(key.privateKey);
}

let published: TestKey[];
let jwksFails: boolean;
let urlSeq = 0;
let jwksUrl: string;

beforeEach(() => {
  published = [];
  jwksFails = false;
  jwksUrl = `${ISSUER}/diagnosis/${urlSeq++}/.well-known/jwks.json`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (jwksFails) return new Response("down", { status: 503 });
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

const options = (token: string, extra: { clockToleranceSeconds?: number } = {}) => ({
  token,
  jwksUrl,
  issuer: ISSUER,
  audience: AUDIENCE,
  ...extra,
});

describe("signingKeyStatus edge cases", () => {
  it("calls a key retired once it was published and later disappeared, even for a newer token", async () => {
    const old = await newKey("old");
    const active = await newKey("active");
    published = [old];
    expect(await signingKeyStatus({ token: await sign(old), jwksUrl })).toBe("current");

    published = [active];
    // Past the key set's refresh window, so the set is refreshed before the key is looked up.
    vi.setSystemTime(Date.now() + STALE_KEY_SET_MS + 1);
    // Issued after the last key set fetch, so only the "has been seen" evidence says retired.
    const token = await sign(old, { issuedAt: Math.floor(Date.now() / 1000) });
    expect(await signingKeyStatus({ token, jwksUrl })).toBe("retired");
  });

  it("keeps a token signed by a key not yet fetched (the issuer rotated just now)", async () => {
    published = [await newKey("active")];
    const stranger = await newKey("brand-new");
    await signingKeyStatus({ token: await sign(published[0] as TestKey), jwksUrl });
    vi.setSystemTime(Date.now() + COOLDOWN_MS + 1);
    const token = await sign(stranger, { issuedAt: Math.floor(Date.now() / 1000) });
    expect(await signingKeyStatus({ token, jwksUrl })).toBe("current");
  });

  it("treats a token with no kid as malformed", async () => {
    const key = await newKey("k");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("user-1")
      .sign(key.privateKey);
    expect(await signingKeyStatus({ token, jwksUrl })).toBe("malformed");
  });

  it("treats a token that is not RS256 as malformed", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: "k" })
      .setSubject("user-1")
      .sign(new TextEncoder().encode("0123456789abcdef0123456789abcdef"));
    expect(await signingKeyStatus({ token, jwksUrl })).toBe("malformed");
  });

  it("fails closed when the key set cannot be fetched: the key counts as current, so nothing is retried", async () => {
    const key = await newKey("k");
    jwksFails = true;
    const token = await sign(key);
    expect(await signingKeyStatus({ token, jwksUrl })).toBe("current");
    expect(await diagnoseTokenRejection(options(token))).toBeNull();
  });
});

describe("expiry", () => {
  it("allows the configured clock tolerance on exp", async () => {
    const key = await newKey("k");
    published = [key];
    const token = await sign(key, { expiresAt: startSeconds - 3 });
    expect(await verifyIdentityToken(options(token))).toBeNull();
    expect(await verifyIdentityToken(options(token, { clockToleranceSeconds: 5 }))).not.toBeNull();
  });

  it("names a genuine token past its exp, and only that", async () => {
    const key = await newKey("k");
    const stranger = await newKey("k");
    published = [key];
    const expired = await sign(key, { issuedAt: startSeconds - 600, expiresAt: startSeconds - 60 });
    expect(await isExpiredWithValidSignature(options(expired))).toBe(true);
    expect(await diagnoseTokenRejection(options(expired))).toBe("token_expired");

    const forged = await sign(stranger, {
      issuedAt: startSeconds - 600,
      expiresAt: startSeconds - 60,
    });
    expect(await diagnoseTokenRejection(options(forged))).toBeNull();

    const wrongAudience = await sign(key, {
      issuedAt: startSeconds - 600,
      expiresAt: startSeconds - 60,
      audience: "lax-art-api",
    });
    expect(await diagnoseTokenRejection(options(wrongAudience))).toBeNull();

    expect(await diagnoseTokenRejection(options(await sign(key)))).toBeNull();
    expect(await diagnoseTokenRejection(options("not-a-jwt"))).toBeNull();
  });

  it("does not call a token expired while it is inside the clock tolerance", async () => {
    const key = await newKey("k");
    published = [key];
    const token = await sign(key, { issuedAt: startSeconds - 600, expiresAt: startSeconds - 3 });
    expect(await diagnoseTokenRejection(options(token))).toBe("token_expired");
    expect(await diagnoseTokenRejection(options(token, { clockToleranceSeconds: 5 }))).toBeNull();
  });

  it("names a retired signing key before it looks at expiry", async () => {
    const retired = await newKey("retired");
    published = [await newKey("active")];
    const token = await sign(retired, {
      issuedAt: startSeconds - 600,
      expiresAt: startSeconds - 60,
    });
    // Fetched after the token was issued, and the key is not in the set.
    vi.setSystemTime(START.getTime() + 60_000);
    expect(await diagnoseTokenRejection(options(token))).toBe("token_key_unknown");
  });
});
