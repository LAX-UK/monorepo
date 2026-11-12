import {
  type EnvelopeCrypto,
  createEnvelopeCrypto,
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
 * protects Identity's provider tokens). Without a key the sealer still reads rows that were never
 * sealed, so a deploy that precedes the key cannot lock anyone out, but it refuses to write: a
 * token is never stored in the clear.
 */
export class XeroTokenSealer {
  constructor(private readonly crypto: Pick<EnvelopeCrypto, "seal" | "open"> | null) {}

  static fromKey(rawKey: string | null | undefined): XeroTokenSealer {
    const trimmed = rawKey?.trim();
    return new XeroTokenSealer(trimmed ? createEnvelopeCrypto(parseAuthDekKey(trimmed)) : null);
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

  /** Sealed values win; plaintext is read only for a row not yet backfilled. */
  open(stored: StoredXeroTokens): XeroTokens {
    return {
      accessToken: this.openOne(stored.accessTokenSealed, stored.accessToken),
      refreshToken: this.openOne(stored.refreshTokenSealed, stored.refreshToken),
    };
  }

  private openOne(sealed: string | null, legacy: string | null): string {
    if (sealed !== null) {
      const crypto = this.requireCrypto();
      try {
        return crypto.open(sealed);
      } catch {
        throw new XeroTokenSealingError("unreadable");
      }
    }
    if (legacy === null || legacy === "") throw new XeroTokenSealingError("tokens_missing");
    return legacy;
  }

  private requireCrypto(): Pick<EnvelopeCrypto, "seal" | "open"> {
    if (!this.crypto) throw new XeroTokenSealingError("key_missing");
    return this.crypto;
  }
}
