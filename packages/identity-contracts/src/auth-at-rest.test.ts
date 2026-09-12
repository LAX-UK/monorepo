import { describe, expect, it } from "vitest";
import {
  accountTokensNeedUpdate,
  createEnvelopeCrypto,
  hashOpaqueToken,
  isEnvelopeSealed,
  isOpaqueTokenFingerprint,
  oauthAccessTokenNeedsUpdate,
  parseAuthDekKey,
  transformAccountTokens,
  transformJwksPrivateJwk,
  transformOauthAccessToken,
  transformTwoFactor,
  twoFactorNeedsUpdate,
} from "./auth-at-rest.js";

const crypto = createEnvelopeCrypto(parseAuthDekKey("00".repeat(32)));

describe("auth at-rest transforms", () => {
  it("seals plaintext account tokens and leaves migrated rows unchanged", () => {
    const before = {
      accessToken: "plain-access",
      refreshToken: null,
      idToken: "plain-id",
    };
    const after = transformAccountTokens(before, crypto);
    expect(after.accessToken).toMatch(/^v1:/);
    expect(after.idToken).toMatch(/^v1:/);
    expect(accountTokensNeedUpdate(before, after)).toBe(true);
    expect(transformAccountTokens(after, crypto)).toEqual(after);
  });

  it("fingerprints OAuth bearer tokens idempotently", () => {
    const before = {
      accessToken: "access-plain",
      refreshToken: "refresh-plain",
      refreshTokenHash: null,
    };
    const after = transformOauthAccessToken(before);
    expect(isOpaqueTokenFingerprint(after.accessToken)).toBe(true);
    expect(isOpaqueTokenFingerprint(after.refreshToken)).toBe(true);
    expect(after.refreshTokenHash).toBe(after.refreshToken.slice("h1:".length));
    expect(oauthAccessTokenNeedsUpdate(before, after)).toBe(true);
    expect(transformOauthAccessToken(after)).toEqual(after);
  });

  it("does not flag fingerprinted tokens whose rotation hash is still unpopulated", () => {
    // Better Auth issues rows without refresh_token_hash; the rotation repository
    // fills it on first refresh. Verification must not treat that as plaintext.
    const issued = {
      accessToken: hashOpaqueToken("access-raw"),
      refreshToken: hashOpaqueToken("refresh-raw"),
      refreshTokenHash: null,
    };
    const after = transformOauthAccessToken(issued);
    expect(after.accessToken).toBe(issued.accessToken);
    expect(after.refreshToken).toBe(issued.refreshToken);
    expect(oauthAccessTokenNeedsUpdate(issued, after)).toBe(false);

    const rotated = { ...issued, refreshTokenHash: issued.refreshToken.slice("h1:".length) };
    expect(oauthAccessTokenNeedsUpdate(rotated, transformOauthAccessToken(rotated))).toBe(false);
  });

  it("seals two-factor secrets and JWKS private keys", () => {
    const before = { secret: "otp-secret", backupCodes: '["abc"]' };
    const after = transformTwoFactor(before, crypto);
    expect(isEnvelopeSealed(after.secret)).toBe(true);
    expect(isEnvelopeSealed(after.backupCodes)).toBe(true);
    expect(twoFactorNeedsUpdate(before, after)).toBe(true);

    const sealedJwk = crypto.seal('{"kty":"RSA"}');
    expect(transformJwksPrivateJwk(sealedJwk, crypto)).toBeNull();
    expect(transformJwksPrivateJwk('{"kty":"RSA"}', crypto)).toMatch(/^v1:/);
  });

  it("fingerprints empty legacy OAuth values deterministically", () => {
    const emptyAccount = transformAccountTokens(
      { accessToken: "", refreshToken: null, idToken: null },
      crypto,
    );
    expect(emptyAccount.accessToken).toMatch(/^v1:/);
    expect(crypto.open(emptyAccount.accessToken ?? "")).toBe("");

    const after = transformOauthAccessToken({
      accessToken: "",
      refreshToken: "still-plain",
      refreshTokenHash: null,
    });
    expect(isOpaqueTokenFingerprint(after.refreshToken)).toBe(true);
  });

  it("rejects malformed or wrong-key migrated values", () => {
    expect(() =>
      transformAccountTokens(
        { accessToken: "v1:not-valid", refreshToken: null, idToken: null },
        crypto,
      ),
    ).toThrow("auth_at_rest_malformed_envelope");
    expect(() =>
      transformOauthAccessToken({
        accessToken: "h1:short",
        refreshToken: "plain",
        refreshTokenHash: null,
      }),
    ).toThrow("auth_at_rest_malformed_token_fingerprint");

    const otherCrypto = createEnvelopeCrypto(parseAuthDekKey("11".repeat(32)));
    const sealed = crypto.seal("secret");
    expect(() => transformTwoFactor({ secret: sealed, backupCodes: sealed }, otherCrypto)).toThrow(
      "auth_at_rest_malformed_envelope",
    );
  });
});
