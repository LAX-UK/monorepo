import {
  type EnvelopeCrypto,
  createEnvelopeCrypto,
  isEnvelopeSealed,
  parseAuthDekKey,
} from "@auction/identity-contracts";
import type { Secret } from "./secret.js";

export class ZohoBooksTokenSealingError extends Error {
  constructor(readonly code: "key_missing" | "key_invalid" | "unreadable") {
    super(`zoho_books_token_sealing_${code}`);
    this.name = "ZohoBooksTokenSealingError";
  }
}

/**
 * Seals and opens Zoho Books OAuth tokens with the AES-256-GCM envelope that already protects
 * Xero's and Identity's tokens (`createEnvelopeCrypto`, `v1:` prefix). The key is required to build
 * one, so a process without it cannot refresh a token it could not then store. Unlike the raw
 * envelope's `open`, a value that is not an envelope is refused rather than returned as written.
 */
export class ZohoBooksTokenSealer {
  private constructor(private readonly crypto: Pick<EnvelopeCrypto, "seal" | "open">) {}

  static fromKey(key: Secret | string | null | undefined): ZohoBooksTokenSealer {
    const raw = typeof key === "string" || key == null ? key : key.reveal();
    const trimmed = raw?.trim();
    if (!trimmed) throw new ZohoBooksTokenSealingError("key_missing");
    try {
      return new ZohoBooksTokenSealer(createEnvelopeCrypto(parseAuthDekKey(trimmed)));
    } catch {
      // The underlying message is static, but nothing derived from the key is ever re-thrown.
      throw new ZohoBooksTokenSealingError("key_invalid");
    }
  }

  seal(plaintext: string): string {
    return this.crypto.seal(plaintext);
  }

  open(sealed: string): string {
    if (!isEnvelopeSealed(sealed)) throw new ZohoBooksTokenSealingError("unreadable");
    try {
      const opened = this.crypto.open(sealed);
      if (opened === "") throw new ZohoBooksTokenSealingError("unreadable");
      return opened;
    } catch {
      throw new ZohoBooksTokenSealingError("unreadable");
    }
  }
}
