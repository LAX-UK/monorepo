import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const AUTH_AT_REST_ENVELOPE_PREFIX = "v1:" as const;
export const AUTH_AT_REST_TOKEN_HASH_PREFIX = "h1:" as const;

export type EnvelopeCrypto = {
  seal(plaintext: string): string;
  open(sealed: string): string;
};

export type AccountTokenRow = {
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
};

export type OauthAccessTokenRow = {
  accessToken: string;
  refreshToken: string;
  /**
   * Unprefixed rotation-family fingerprint. Better Auth issues rows with this
   * null; the refresh rotation repository populates it lazily on first use, so
   * a null value is not a storage-protection defect.
   */
  refreshTokenHash: string | null;
};

export type TwoFactorRow = {
  secret: string;
  backupCodes: string;
};

export function isEnvelopeSealed(value: string): boolean {
  return value.startsWith(AUTH_AT_REST_ENVELOPE_PREFIX);
}

export function isOpaqueTokenFingerprint(value: string): boolean {
  return value.startsWith(AUTH_AT_REST_TOKEN_HASH_PREFIX);
}

export function hashOpaqueToken(value: string): string {
  return `${AUTH_AT_REST_TOKEN_HASH_PREFIX}${createHash("sha256")
    .update(value)
    .digest("base64url")}`;
}

export function parseAuthDekKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const buf = Buffer.from(b64 + pad, "base64");
  if (buf.length !== 32) {
    throw new Error(
      "AUTH_DEK_KEY must decode to exactly 32 bytes (use 64 hex chars or base64 of 32 bytes)",
    );
  }
  return buf;
}

export function createEnvelopeCrypto(dek: Buffer): EnvelopeCrypto {
  if (dek.length !== 32) {
    throw new Error("createEnvelopeCrypto: DEK must be 32 bytes (AES-256)");
  }
  return {
    seal(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", dek, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return `${AUTH_AT_REST_ENVELOPE_PREFIX}${Buffer.concat([
        iv,
        cipher.getAuthTag(),
        encrypted,
      ]).toString("base64url")}`;
    },
    open(sealed: string): string {
      if (!isEnvelopeSealed(sealed)) return sealed;
      const raw = Buffer.from(sealed.slice(AUTH_AT_REST_ENVELOPE_PREFIX.length), "base64url");
      if (raw.length < 28) throw new Error("envelope: truncated payload");
      const decipher = createDecipheriv("aes-256-gcm", dek, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    },
  };
}

function assertValidEnvelope(value: string, crypto: EnvelopeCrypto): void {
  try {
    crypto.open(value);
  } catch {
    throw new Error("auth_at_rest_malformed_envelope");
  }
}

function preserveValidFingerprint(value: string): string {
  if (!/^h1:[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new Error("auth_at_rest_malformed_token_fingerprint");
  }
  return value;
}

export function transformAccountTokens(
  row: AccountTokenRow,
  crypto: EnvelopeCrypto,
): AccountTokenRow {
  const sealIfNeeded = (value: string | null): string | null => {
    if (value == null) return value;
    if (isEnvelopeSealed(value)) {
      assertValidEnvelope(value, crypto);
      return value;
    }
    return crypto.seal(value);
  };
  return {
    accessToken: sealIfNeeded(row.accessToken),
    refreshToken: sealIfNeeded(row.refreshToken),
    idToken: sealIfNeeded(row.idToken),
  };
}

export function accountTokensNeedUpdate(before: AccountTokenRow, after: AccountTokenRow): boolean {
  return (
    before.accessToken !== after.accessToken ||
    before.refreshToken !== after.refreshToken ||
    before.idToken !== after.idToken
  );
}

export function transformOauthAccessToken(row: OauthAccessTokenRow): OauthAccessTokenRow {
  const accessToken = isOpaqueTokenFingerprint(row.accessToken)
    ? preserveValidFingerprint(row.accessToken)
    : hashOpaqueToken(row.accessToken);
  const refreshToken = isOpaqueTokenFingerprint(row.refreshToken)
    ? preserveValidFingerprint(row.refreshToken)
    : hashOpaqueToken(row.refreshToken);
  return {
    accessToken,
    refreshToken,
    refreshTokenHash:
      row.refreshTokenHash ?? refreshToken.slice(AUTH_AT_REST_TOKEN_HASH_PREFIX.length),
  };
}

/**
 * A row needs the backfill only when a bearer token is still stored in plaintext.
 * The rotation hash is derived alongside that rewrite; on its own, a missing hash
 * is the expected state of a token that has never been refreshed.
 */
export function oauthAccessTokenNeedsUpdate(
  before: OauthAccessTokenRow,
  after: OauthAccessTokenRow,
): boolean {
  return before.accessToken !== after.accessToken || before.refreshToken !== after.refreshToken;
}

export function transformTwoFactor(row: TwoFactorRow, crypto: EnvelopeCrypto): TwoFactorRow {
  const sealIfNeeded = (value: string): string => {
    if (isEnvelopeSealed(value)) {
      assertValidEnvelope(value, crypto);
      return value;
    }
    return crypto.seal(value);
  };
  return {
    secret: sealIfNeeded(row.secret),
    backupCodes: sealIfNeeded(row.backupCodes),
  };
}

export function twoFactorNeedsUpdate(before: TwoFactorRow, after: TwoFactorRow): boolean {
  return before.secret !== after.secret || before.backupCodes !== after.backupCodes;
}

export function transformJwksPrivateJwk(raw: string, crypto: EnvelopeCrypto): string | null {
  if (isEnvelopeSealed(raw)) {
    assertValidEnvelope(raw, crypto);
    return null;
  }
  return crypto.seal(raw);
}
