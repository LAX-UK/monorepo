import type { OnsiteEventRsvp } from "@auction/types";
import { decryptCheckInToken, encryptCheckInToken } from "../lib/check-in-token-ciphertext.js";
import { issueCheckInToken } from "../lib/onsite-event-check-in-token.js";

export type ResolvedCheckInToken = {
  plainToken: string;
  tokenHash: string;
  issuedAt: Date;
  ciphertext: string;
};

/**
 * Check-in token issuance/encryption for onsite-event RSVPs and passes.
 * Shared by the guest (`submitRsvp`) and admin (`resendPass`) services so the
 * AES-256-GCM envelope and the "reuse the token when it still decrypts, else
 * reissue" policy live in exactly one place.
 */
export class OnsiteEventPassTokenService {
  constructor(private readonly cipherSecret: string | null) {}

  /** Reuses the RSVP's existing plaintext token when it can still be decrypted; issues a new one otherwise. */
  resolveTokenForRsvp(existing: OnsiteEventRsvp | null): ResolvedCheckInToken {
    if (existing?.checkInTokenCiphertext && existing.checkInTokenHash) {
      const plainToken = this.decryptStoredToken(existing.checkInTokenCiphertext);
      if (plainToken) {
        return {
          plainToken,
          tokenHash: existing.checkInTokenHash,
          issuedAt: existing.checkInTokenIssuedAt ?? new Date(),
          ciphertext: existing.checkInTokenCiphertext,
        };
      }
    }
    return this.issueToken();
  }

  /** Issues a brand new token, e.g. for a legacy RSVP that never had one. */
  issueToken(): ResolvedCheckInToken {
    const issued = issueCheckInToken();
    return {
      plainToken: issued.plainToken,
      tokenHash: issued.tokenHash,
      issuedAt: new Date(),
      ciphertext: this.encryptToken(issued.plainToken),
    };
  }

  decryptStoredToken(ciphertext: string | null): string | null {
    if (!ciphertext || !this.cipherSecret) return null;
    return decryptCheckInToken(ciphertext, this.cipherSecret);
  }

  private encryptToken(plainToken: string): string {
    if (!this.cipherSecret) {
      throw new Error("Check-in token encryption secret is not configured");
    }
    return encryptCheckInToken(plainToken, this.cipherSecret);
  }
}
