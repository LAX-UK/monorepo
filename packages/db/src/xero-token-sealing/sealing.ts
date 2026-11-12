import {
  type EnvelopeCrypto,
  createEnvelopeCrypto,
  isEnvelopeSealed,
  parseAuthDekKey,
} from "@auction/identity-contracts";

/** What the database holds for one connection's OAuth tokens. */
export type StoredXeroTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenSealed: string | null;
  refreshTokenSealed: string | null;
};

export type XeroTokens = { accessToken: string; refreshToken: string };

/** What a write stores: sealed values only. The plaintext columns are always nulled. */
export type SealedXeroTokenColumns = {
  accessToken: null;
  refreshToken: null;
  accessTokenSealed: string;
  refreshTokenSealed: string;
};

export class XeroTokenSealingError extends Error {
  constructor(readonly code: "key_missing" | "unreadable" | "tokens_missing") {
    super(`xero_token_sealing_${code}`);
    this.name = "XeroTokenSealingError";
  }
}

/**
 * Seals and opens Xero OAuth tokens with the existing AES-256-GCM envelope (the same one that
 * protects Identity's provider tokens). The key is required for every read and every write: a
 * sealer without one throws `key_missing` before anything is read or sent to Xero, so a refresh
 * can never be made whose rotated token could not then be stored.
 */
export class XeroTokenSealer {
  private constructor(private readonly crypto: Pick<EnvelopeCrypto, "seal" | "open"> | null) {}

  /** Throws `key_missing` when the key is absent or blank, and rejects a malformed key. */
  static fromKey(rawKey: string | null | undefined): XeroTokenSealer {
    const trimmed = rawKey?.trim();
    if (!trimmed) throw new XeroTokenSealingError("key_missing");
    try {
      return new XeroTokenSealer(createEnvelopeCrypto(parseAuthDekKey(trimmed)));
    } catch {
      throw new Error("XERO_TOKEN_DEK_KEY must be 64 hex chars or base64 of exactly 32 bytes");
    }
  }

  /** For a process where Xero is not configured: every operation fails closed. */
  static unavailable(): XeroTokenSealer {
    return new XeroTokenSealer(null);
  }

  seal(tokens: XeroTokens): SealedXeroTokenColumns {
    const crypto = this.requireCrypto();
    return {
      accessToken: null,
      refreshToken: null,
      accessTokenSealed: crypto.seal(tokens.accessToken),
      refreshTokenSealed: crypto.seal(tokens.refreshToken),
    };
  }

  /**
   * A non-null plaintext value wins over the sealed one: only a release that predates sealing
   * writes plaintext, so it is always the newer write (the backfill applies the same rule).
   */
  open(stored: StoredXeroTokens): XeroTokens {
    return {
      accessToken: this.openOne(stored.accessTokenSealed, stored.accessToken),
      refreshToken: this.openOne(stored.refreshTokenSealed, stored.refreshToken),
    };
  }

  private openOne(sealed: string | null, legacy: string | null): string {
    const crypto = this.requireCrypto();
    if (legacy !== null && legacy !== "") return legacy;
    if (sealed === null || sealed === "") throw new XeroTokenSealingError("tokens_missing");
    if (!isEnvelopeSealed(sealed)) throw new XeroTokenSealingError("unreadable");
    try {
      return crypto.open(sealed);
    } catch {
      throw new XeroTokenSealingError("unreadable");
    }
  }

  private requireCrypto(): Pick<EnvelopeCrypto, "seal" | "open"> {
    if (!this.crypto) throw new XeroTokenSealingError("key_missing");
    return this.crypto;
  }
}
